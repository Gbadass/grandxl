import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import { Model, Types } from 'mongoose'
import type { Queue } from 'bullmq'
import { OrderDocument } from './schemas/order.schema'
import { CounterDocument } from './schemas/counter.schema'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { QueryOrdersDto } from './dto/query-orders.dto'
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto'
import type { RateOrderDto } from './dto/rate-order.dto'
import { MenuItemsService } from '../menu-items/menu-items.service'
import { NotificationsService } from '../notifications/notifications.service'
import { TrackingService } from '../tracking/tracking.service'
import { PlatformConfigService } from '../platform-config/platform-config.service'
import { RestaurantsService } from '../restaurants/restaurants.service'
import { WalletService } from '../wallet/wallet.service'
import { WalletTxnReason } from '../wallet/schemas/wallet-transaction.schema'
import { DeliveryZonesService } from '../delivery-zones/delivery-zones.service'
import { SurgePricingService } from '../surge-pricing/surge-pricing.service'
import { RidersService } from '../riders/riders.service'
import {
  ORDER_TIMEOUT_QUEUE,
  RIDER_DISPATCH_QUEUE,
  SCHEDULED_ORDER_QUEUE,
  ORDER_TIMEOUT_DELAY_MS,
  SCHEDULED_ORDER_PREP_BUFFER_MIN,
} from '../jobs/constants/queue.constants'
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'
import { MAX_ORDER_VALUE_KOBO } from '../../common/constants/app.constants'
import { isRestaurantOpen, formatMoney } from '@grandxl/utils'
import type { RestaurantHours } from '@grandxl/utils'

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:  [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]:  [OrderStatus.READY],
  [OrderStatus.READY]:      [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]:  [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]:  [],
  [OrderStatus.CANCELLED]:  [],
}

// Fallback values used only if platform config is somehow missing (bootstrap race).
const DEFAULT_SERVICE_FEE_PERCENT = 5
const DEFAULT_SERVICE_FEE_CAP_KOBO = 150_000

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(CounterDocument.name)
    private readonly counterModel: Model<CounterDocument>,
    private readonly menuItemsService: MenuItemsService,
    private readonly notificationsService: NotificationsService,
    private readonly trackingService: TrackingService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly restaurantsService: RestaurantsService,
    private readonly walletService: WalletService,
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly surgePricingService: SurgePricingService,
    @Inject(forwardRef(() => RidersService))
    private readonly ridersService: RidersService,
    @InjectQueue(ORDER_TIMEOUT_QUEUE) private readonly orderTimeoutQueue: Queue,
    @InjectQueue(RIDER_DISPATCH_QUEUE) private readonly riderDispatchQueue: Queue,
    @InjectQueue(SCHEDULED_ORDER_QUEUE) private readonly scheduledOrderQueue: Queue,
  ) {}

  // ── Atomic order number (GXL-YYYYMMDD-XXXX) ──────────────────────

  private async nextOrderNumber(): Promise<string> {
    const counter = await this.counterModel.findByIdAndUpdate(
      'order_seq',
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    )
    const date = new Date()
    const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const seq = String(counter!.seq).padStart(4, '0')
    return `GXL-${yyyymmdd}-${seq}`
  }

  // ── Estimate order pricing (no side effects) ─────────────────────
  // Returns the same breakdown as createOrder but without saving anything.
  // Used by the frontend to show real-time cost before the customer confirms.

  async estimateOrder(customerId: string, dto: CreateOrderDto): Promise<{
    subtotal: number
    deliveryFee: number
    serviceFee: number
    discount: number
    total: number
    surgeMultiplier: number
    currency: string
    isFirstOrder: boolean
  }> {
    if (!Types.ObjectId.isValid(dto.restaurantId)) {
      throw new BadRequestException('Invalid restaurant ID')
    }
    const [restaurant, platformConfig] = await Promise.all([
      this.restaurantsService.findByIdRaw(dto.restaurantId),
      this.platformConfigService.getConfig().catch(() => null),
    ])
    if (!restaurant.isApproved || !restaurant.isActive) {
      throw new BadRequestException('Restaurant not available')
    }

    const serviceFeePercent = (platformConfig?.serviceFeePercent ?? DEFAULT_SERVICE_FEE_PERCENT) / 100
    const serviceFeeCap = platformConfig?.serviceFeeCapKobo ?? DEFAULT_SERVICE_FEE_CAP_KOBO

    const menuItemIds = dto.items.map((i) => i.menuItemId)
    const menuItems = await this.menuItemsService.findItemsByIds(menuItemIds)
    const menuItemMap = new Map(menuItems.map((m) => [m._id.toString(), m]))

    let subtotal = 0
    for (const input of dto.items) {
      const menuItem = menuItemMap.get(input.menuItemId)
      if (!menuItem) throw new BadRequestException(`Menu item not found: ${input.menuItemId}`)
      if (!menuItem.isAvailable) throw new BadRequestException(`"${menuItem.name}" is not available`)
      const variantTotal = (input.selectedVariants ?? []).reduce((sum, sv) => {
        const opt = menuItem.variants.find((v) => v.name === sv.variantName)?.options.find((o) => o.name === sv.optionName)
        return sum + (opt?.priceAdjustment ?? 0)
      }, 0)
      const addOnTotal = (input.selectedAddOns ?? []).reduce((sum, sa) => {
        const addOn = menuItem.addOns.find((a) => a.name === sa.name && a.isAvailable)
        return sum + (addOn?.price ?? 0)
      }, 0)
      subtotal += (menuItem.basePrice + variantTotal + addOnTotal) * input.quantity
    }

    const zone = await this.deliveryZonesService.findZoneForPoint(
      dto.deliveryAddress.coordinates.lat,
      dto.deliveryAddress.coordinates.lng,
    )
    // Mirror the same zone coverage logic as createOrder — if zones are configured,
    // an address outside all of them is undeliverable and the estimate should say so.
    const hasAnyZones = zone !== null || (await this.deliveryZonesService.listAll()).length > 0
    if (hasAnyZones && !zone) {
      throw new BadRequestException("Sorry — we don't deliver to this address yet")
    }
    const zoneMultiplier = zone?.deliveryFeeMultiplier ?? 1.0

    const rawSurge = await this.surgePricingService.getMultiplierAt(new Date())
    const surgeMultiplier = Math.min(rawSurge, 5.0)
    const uncappedFee = Math.round(restaurant.deliveryFeeFixed * zoneMultiplier * surgeMultiplier)
    const deliveryFee = Math.min(uncappedFee, restaurant.deliveryFeeFixed * 5)

    const serviceFee = Math.min(Math.round(subtotal * serviceFeePercent), serviceFeeCap)

    let discount = 0
    let freeDelivery = false
    if (dto.couponCode) {
      try {
        const couponResult = await this.platformConfigService.validateCoupon(
          dto.couponCode, dto.restaurantId, subtotal, customerId,
        )
        const coupon = await this.platformConfigService.getCouponByCode(dto.couponCode)
        if (coupon?.type === 'free_delivery') {
          freeDelivery = true
          discount = deliveryFee
        } else {
          discount = couponResult.discountKobo
        }
      } catch {
        // Invalid coupon — estimate continues without discount
      }
    }

    if (!freeDelivery) {
      const previousOrderCount = await this.orderModel.countDocuments({
        customerId: new Types.ObjectId(customerId),
        status: { $ne: OrderStatus.CANCELLED },
      })
      if (previousOrderCount === 0) {
        freeDelivery = true
        discount = deliveryFee
      }
    }

    const effectiveDeliveryFee = freeDelivery ? 0 : deliveryFee
    const total = Math.max(0, subtotal + effectiveDeliveryFee + serviceFee - discount)

    return {
      subtotal,
      deliveryFee: effectiveDeliveryFee,
      serviceFee,
      discount,
      total,
      surgeMultiplier,
      currency: restaurant.currency,
      isFirstOrder: false,
    }
  }

  // ── Place order ──────────────────────────────────────────────────

  async createOrder(customerId: string, dto: CreateOrderDto): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(dto.restaurantId)) {
      throw new BadRequestException('Invalid restaurant ID')
    }
    const [restaurant, platformConfig] = await Promise.all([
      this.restaurantsService.findByIdRaw(dto.restaurantId),
      this.platformConfigService.getConfig().catch(() => null),
    ])
    if (!restaurant.isApproved || !restaurant.isActive) {
      throw new BadRequestException('Restaurant not available')
    }
    if (!restaurant.isOpen) {
      throw new BadRequestException('Restaurant is currently closed')
    }
    if (restaurant.openingHours && !isRestaurantOpen(restaurant.openingHours as unknown as RestaurantHours)) {
      throw new BadRequestException('Restaurant is currently outside their opening hours')
    }

    const serviceFeePercent = (platformConfig?.serviceFeePercent ?? DEFAULT_SERVICE_FEE_PERCENT) / 100
    const serviceFeeCap = platformConfig?.serviceFeeCapKobo ?? DEFAULT_SERVICE_FEE_CAP_KOBO

    const menuItemIds = dto.items.map((i) => i.menuItemId)
    const invalidId = menuItemIds.find((id) => !Types.ObjectId.isValid(id))
    if (invalidId) throw new BadRequestException(`Invalid menu item ID: ${invalidId}`)

    const menuItems = await this.menuItemsService.findItemsByIds(menuItemIds)
    const menuItemMap = new Map(menuItems.map((m) => [m._id.toString(), m]))

    let subtotal = 0
    const orderItems = dto.items.map((input) => {
      const menuItem = menuItemMap.get(input.menuItemId)
      if (!menuItem) throw new BadRequestException(`Menu item not found: ${input.menuItemId}`)
      if (!menuItem.isAvailable) throw new BadRequestException(`"${menuItem.name}" is not available`)
      if (menuItem.restaurantId.toString() !== dto.restaurantId) {
        throw new BadRequestException(`"${menuItem.name}" does not belong to this restaurant`)
      }
      // Stock check (null = unlimited). Only enforced if the restaurant set a stockCount.
      if (menuItem.stockCount !== null && menuItem.stockCount !== undefined) {
        if (menuItem.stockCount < input.quantity) {
          throw new BadRequestException(
            `Only ${menuItem.stockCount} of "${menuItem.name}" left — adjust your order`,
          )
        }
      }

      const resolvedVariants = (input.selectedVariants ?? []).map((sv) => {
        const variant = menuItem.variants.find((v) => v.name === sv.variantName)
        if (!variant) throw new BadRequestException(`"${menuItem.name}" has no variant "${sv.variantName}"`)
        const option = variant.options.find((o) => o.name === sv.optionName)
        if (!option) throw new BadRequestException(`Variant "${sv.variantName}" has no option "${sv.optionName}"`)
        return { variantName: sv.variantName, optionName: sv.optionName, priceAdjustment: option.priceAdjustment }
      })

      const resolvedAddOns = (input.selectedAddOns ?? []).map((sa) => {
        const addOn = menuItem.addOns.find((a) => a.name === sa.name)
        if (!addOn) throw new BadRequestException(`"${menuItem.name}" has no add-on "${sa.name}"`)
        if (!addOn.isAvailable) throw new BadRequestException(`Add-on "${sa.name}" is not currently available`)
        return { name: sa.name, price: addOn.price }
      })

      const variantTotal = resolvedVariants.reduce((s, v) => s + v.priceAdjustment, 0)
      const addOnTotal   = resolvedAddOns.reduce((s, a) => s + a.price, 0)
      const itemTotal    = (menuItem.basePrice + variantTotal + addOnTotal) * input.quantity
      subtotal += itemTotal

      return {
        menuItemId: new Types.ObjectId(input.menuItemId),
        name: menuItem.name,
        image: menuItem.image,
        basePrice: menuItem.basePrice,
        quantity: input.quantity,
        selectedVariants: resolvedVariants,
        selectedAddOns:   resolvedAddOns,
        itemTotal,
        note: input.note ?? null,
      }
    })

    if (subtotal < restaurant.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ${formatMoney(restaurant.minOrderAmount, 'NGN')}`,
      )
    }
    if (subtotal > MAX_ORDER_VALUE_KOBO) {
      throw new BadRequestException('Order value cannot exceed ₦500,000')
    }

    // Zone-based delivery fee. If any zones exist we require the address to
    // fall inside an active one. If none exist yet (bootstrap phase), fall back
    // to the restaurant's base fee.
    const zone = await this.deliveryZonesService.findZoneForPoint(
      dto.deliveryAddress.coordinates.lat,
      dto.deliveryAddress.coordinates.lng,
    )
    const hasAnyZones = zone !== null || (await this.deliveryZonesService.listAll()).length > 0
    if (hasAnyZones && !zone) {
      throw new BadRequestException("Sorry — we don't deliver to this address yet")
    }
    const zoneMultiplier  = zone?.deliveryFeeMultiplier ?? 1.0
    // Surge stacks on the zone multiplier. Combined result is capped at 5× the base
    // fee to prevent pathological edge-cases (e.g. 3× surge × 2× zone = 6× base).
    const rawSurge = await this.surgePricingService.getMultiplierAt(new Date())
    const surgeMultiplier = Math.min(rawSurge, 5.0) // safety cap — bad surge rule can't create astronomical fees
    const uncappedFee = Math.round(restaurant.deliveryFeeFixed * zoneMultiplier * surgeMultiplier)
    const deliveryFee = Math.min(uncappedFee, restaurant.deliveryFeeFixed * 5)

    const serviceFee = Math.min(Math.round(subtotal * serviceFeePercent), serviceFeeCap)
    const vat = 0

    // Coupon validation — only if a code was provided
    let discount = 0
    let appliedCouponId: string | null = null
    let freeDelivery = false

    if (dto.couponCode) {
      const couponResult = await this.platformConfigService.validateCoupon(
        dto.couponCode,
        dto.restaurantId,
        subtotal,
        customerId,
      )
      // Check if this is a free_delivery coupon by re-reading the coupon type
      const coupon = await this.platformConfigService.getCouponByCode(dto.couponCode)
      if (coupon?.type === 'free_delivery') {
        freeDelivery = true
        discount = deliveryFee
      } else {
        discount = couponResult.discountKobo
      }
      appliedCouponId = couponResult.couponId
    }

    // Automatic first-order free delivery — no coupon needed
    if (!freeDelivery) {
      const previousOrderCount = await this.orderModel.countDocuments({
        customerId: new Types.ObjectId(customerId),
        status: { $ne: OrderStatus.CANCELLED },
      })
      if (previousOrderCount === 0) {
        freeDelivery = true
        discount = deliveryFee
      }
    }

    // Tip is on top of delivery fee and 100% goes to the rider — never net out against discounts.
    const tip = Math.max(0, Math.floor(dto.tip ?? 0))

    // Scheduled order validation
    let scheduledFor: Date | null = null
    if (dto.scheduledFor) {
      const when     = new Date(dto.scheduledFor)
      const now      = Date.now()
      const minAhead = 60 * 60 * 1000        // 60 min lead time so kitchen has runway
      const maxAhead = 7 * 24 * 60 * 60 * 1000 // 7 days
      if (Number.isNaN(when.getTime())) {
        throw new BadRequestException('scheduledFor is not a valid date')
      }
      if (when.getTime() < now + minAhead) {
        throw new BadRequestException('Scheduled orders must be at least 60 minutes from now')
      }
      if (when.getTime() > now + maxAhead) {
        throw new BadRequestException('Scheduled orders can be no more than 7 days out')
      }
      if (restaurant.openingHours && !isRestaurantOpen(restaurant.openingHours as unknown as RestaurantHours, 'Africa/Lagos', when)) {
        throw new BadRequestException('Restaurant will be closed at the scheduled time')
      }
      scheduledFor = when
    }

    const total = subtotal + (freeDelivery ? 0 : deliveryFee) + serviceFee - (freeDelivery ? 0 : discount) + vat + tip

    // Wallet application: debit min(balance, total). Locks the customer's balance to this order
    // so they can't double-spend if they hit checkout twice. If order is cancelled later we
    // refund the wallet — handled in the cancellation flow.
    let walletApplied = 0
    if (dto.useWallet) {
      const { balance } = await this.walletService.getBalance(customerId)
      walletApplied = Math.min(balance, total)
      if (walletApplied > 0) {
        await this.walletService.debit({
          userId:        customerId,
          amount:        walletApplied,
          reason:        WalletTxnReason.ORDER_PAYMENT,
          description:   `Applied to new order`,
          referenceType: 'order_pending',
          referenceId:   customerId, // overwritten once order has an id — see post-save patch below
        })
      }
    }

    const order = await new this.orderModel({
      orderNumber: await this.nextOrderNumber(),
      customerId: new Types.ObjectId(customerId),
      restaurantId:      new Types.ObjectId(dto.restaurantId),
      restaurantOwnerId: new Types.ObjectId(restaurant.ownerId.toString()),
      riderId: null,
      status: OrderStatus.PENDING,
      items: orderItems,
      deliveryAddress: {
        street: dto.deliveryAddress.street,
        city: dto.deliveryAddress.city,
        state: dto.deliveryAddress.state,
        coordinates: {
          type: 'Point',
          coordinates: [dto.deliveryAddress.coordinates.lng, dto.deliveryAddress.coordinates.lat],
        },
      },
      // Snapshot restaurant location so riders can navigate to pickup without a separate fetch
      restaurantPickupAddress: {
        street: restaurant.address.street,
        city: restaurant.address.city,
        state: restaurant.address.state,
        coordinates: restaurant.address.coordinates,
      },
      pricing: {
        subtotal,
        deliveryFee: freeDelivery ? 0 : deliveryFee,
        serviceFee,
        discount,
        vat,
        tip,
        walletApplied,
        total,
      },
      payment: {
        method: dto.paymentMethod,
        // If wallet covers the entire bill, the order is paid the moment it's created.
        status: walletApplied >= total ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
        reference: walletApplied >= total ? `WALLET-FULL-${Date.now()}` : null,
        paidAt: walletApplied >= total ? new Date() : null,
      },
      coupon: { code: dto.couponCode ?? null, discountAmount: discount },
      customerNote: dto.customerNote ?? null,
      deliveryInstructions: dto.deliveryInstructions ?? null,
      estimatedTime: restaurant.estimatedDeliveryTime,
      country: restaurant.country,
      currency: restaurant.currency,
      scheduledFor,
    }).save()

    // For scheduled orders: enqueue a delayed release. Restaurant won't see the
    // order in their live queue until the worker fires at scheduledFor - prep buffer.
    if (scheduledFor) {
      const releaseAt = scheduledFor.getTime() - SCHEDULED_ORDER_PREP_BUFFER_MIN * 60 * 1000
      const delay    = Math.max(0, releaseAt - Date.now())
      const job = await this.scheduledOrderQueue
        .add('release', { orderId: order._id.toString() }, { delay })
        .catch(() => undefined)
      if (job) {
        await this.orderModel.findByIdAndUpdate(order._id, { scheduledReleaseJobId: job.id })
      }
    }

    // Record coupon usage — tracks both global count and per-user usage for limit enforcement.
    // Fire-and-forget: a usage tracking failure must not roll back a successfully placed order.
    if (appliedCouponId) {
      this.platformConfigService
        .recordCouponUsage(appliedCouponId, customerId, order._id.toString())
        .catch(() => undefined)
    }

    // Decrement stock atomically for each item. Race-safe via $gte filter — if any
    // item was concurrently sold out, this catches it. We pre-validated in the loop
    // above, but the gap between check and write is exactly what this guard exists for.
    const decrementedItems: Array<{ menuItemId: string; quantity: number }> = []
    for (const it of orderItems) {
      const result = await this.menuItemsService.tryDecrementStock(
        it.menuItemId.toString(),
        it.quantity,
      )
      if (!result.ok) {
        // Roll back previously decremented items in this same order — prevents stock leak
        // when the failure occurs mid-loop and earlier items were already decremented.
        await Promise.allSettled(
          decrementedItems.map((d) => this.menuItemsService.restock(d.menuItemId, d.quantity)),
        )

        await this.orderModel.findByIdAndUpdate(order._id, {
          $set: { status: OrderStatus.CANCELLED, cancelReason: result.reason },
        })

        // Wallet refund is blocking — silent failure here would mean the customer loses
        // money with no recourse. If the credit fails we surface the error rather than
        // hiding it, so an operator can manually review.
        if (walletApplied > 0) {
          await this.walletService.credit({
            userId:        customerId,
            amount:        walletApplied,
            reason:        WalletTxnReason.REFUND,
            description:   'Wallet credit returned — out of stock at order create',
            referenceType: 'order',
            referenceId:   order._id.toString(),
          })
        }

        // Restore coupon slot so the customer can re-try with a different restaurant
        if (appliedCouponId) {
          this.platformConfigService
            .revokeCouponUsage(order._id.toString())
            .catch(() => undefined)
        }

        throw new BadRequestException(result.reason)
      }
      decrementedItems.push({ menuItemId: it.menuItemId.toString(), quantity: it.quantity })
    }

    // Auto-cancel if unpaid after 15 minutes (no-op for cash orders that get confirmed below)
    this.orderTimeoutQueue
      .add('check-timeout', { orderId: order._id.toString() }, { delay: ORDER_TIMEOUT_DELAY_MS })
      .catch(() => undefined)

    const ownerId = restaurant.ownerId.toString()
    const orderId = order._id.toString()

    // Cash on delivery: skip payment gate — confirm and dispatch rider immediately
    if (dto.paymentMethod === PaymentMethod.CASH) {
      const confirmed = await this.orderModel.findByIdAndUpdate(
        order._id,
        {
          $set: {
            status: OrderStatus.CONFIRMED,
            'payment.status': PaymentStatus.COMPLETED,
            'payment.paidAt': new Date(),
          },
        },
        { new: true },
      ) ?? order

      Promise.all([
        this.notificationsService.onOrderPlaced(customerId, ownerId, confirmed.orderNumber, orderId),
        this.trackingService.notifyNewOrder(ownerId, confirmed),
        this.riderDispatchQueue.add('dispatch', {
          orderId,
          lng: dto.deliveryAddress.coordinates.lng,
          lat: dto.deliveryAddress.coordinates.lat,
        }),
      ]).catch(() => undefined)

      return confirmed
    }

    // Card / wallet: only notify the customer that the order was placed.
    // The restaurant alert fires in markPaymentComplete() after Paystack confirms payment.
    this.notificationsService
      .onOrderPlaced(customerId, ownerId, order.orderNumber, orderId)
      .catch(() => undefined)

    return order
  }

  // ── Customer — view their own orders ─────────────────────────────

  async getCustomerOrders(
    customerId: string,
    query: QueryOrdersDto,
  ): Promise<{ data: OrderDocument[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const filter: Record<string, unknown> = { customerId: new Types.ObjectId(customerId), systemClearedAt: null }
    if (query.status) filter.status = query.status

    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orderModel.countDocuments(filter),
    ])
    return { data: data as unknown as OrderDocument[], meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  async getCustomerOrderById(orderId: string, customerId: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')
    const order = await this.orderModel.findById(orderId)
    if (!order) throw new NotFoundException('Order not found')
    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException('You do not have access to this order')
    }
    return order
  }

  async rateOrder(
    orderId: string,
    customerId: string,
    dto: RateOrderDto,
  ): Promise<{ rated: boolean }> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')
    const order = await this.orderModel.findById(orderId)
    if (!order) throw new NotFoundException('Order not found')
    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException('You do not have access to this order')
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('You can only rate an order after it has been delivered')
    }
    if (order.ratedAt !== null) {
      throw new ConflictException('You have already rated this order')
    }

    await this.orderModel.findByIdAndUpdate(orderId, {
      $set: {
        rating:     dto.rating,
        reviewText: dto.reviewText ?? null,
        ratedAt:    new Date(),
      },
    })

    // Update restaurant's running average — fire-and-forget; rating failure must
    // not surface back to the customer (the order is already rated at this point).
    this.restaurantsService
      .updateRating(order.restaurantId.toString(), dto.rating)
      .catch(() => undefined)

    return { rated: true }
  }

  // ── Restaurant — view incoming orders ────────────────────────────

  async getRestaurantOrders(
    restaurantId: string,
    query: QueryOrdersDto,
    requester: JwtPayload,
  ): Promise<{ data: OrderDocument[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    if (!requester.roles.includes(UserRole.SUPER_ADMIN)) {
      const owned = await this.restaurantsService.findByOwner(requester.sub)
      if (!owned.some((r) => r._id.toString() === restaurantId)) {
        throw new ForbiddenException('Restaurant does not belong to you')
      }
    }

    const filter: Record<string, unknown> = {
      restaurantId: new Types.ObjectId(restaurantId),
      restaurantClearedAt: null,
      systemClearedAt: null,
    }
    if (query.status) filter.status = query.status

    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orderModel.countDocuments(filter),
    ])
    return { data: data as unknown as OrderDocument[], meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  async clearRestaurantHistory(restaurantId: string, requesterSub: string): Promise<{ cleared: number }> {
    // Verify ownership
    const restaurants = await this.restaurantsService.findByOwner(requesterSub)
    const owns = restaurants.some((r) => r._id.toString() === restaurantId)
    if (!owns) throw new ForbiddenException('Restaurant does not belong to you')

    // Only soft-delete terminal statuses — never touch live orders
    const result = await this.orderModel.updateMany(
      {
        restaurantId: new Types.ObjectId(restaurantId),
        status: { $in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        restaurantClearedAt: null,
      },
      { $set: { restaurantClearedAt: new Date() } },
    )
    return { cleared: result.modifiedCount }
  }

  async clearAllOrders(): Promise<{ cleared: number }> {
    const result = await this.orderModel.updateMany(
      {
        systemClearedAt: null,
        status: { $in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
      },
      { $set: { systemClearedAt: new Date() } },
    )
    return { cleared: result.modifiedCount }
  }

  // ── Status transitions ────────────────────────────────────────────

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    requester: JwtPayload,
  ): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')
    const order = await this.orderModel.findById(orderId)
    if (!order) throw new NotFoundException('Order not found')

    await this.assertTransitionPermission(order, dto, requester)

    const updates: Record<string, unknown> = { status: dto.status }
    if (dto.status === OrderStatus.CANCELLED) {
      updates.cancelReason = dto.cancelReason ?? 'No reason given'
    }
    if (dto.status === OrderStatus.DELIVERED) {
      updates.actualDeliveryAt = new Date()
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(orderId, { $set: updates }, { new: true })
      .exec()
    if (!updated) throw new NotFoundException('Order not found')

    // Refund wallet if order is cancelled and wallet was applied. Fire-and-forget;
    // failure here shouldn't roll back the cancellation but must be logged.
    if (
      dto.status === OrderStatus.CANCELLED &&
      (order.pricing.walletApplied ?? 0) > 0
    ) {
      this.walletService
        .credit({
          userId:        order.customerId.toString(),
          amount:        order.pricing.walletApplied,
          reason:        WalletTxnReason.REFUND,
          description:   `Wallet credit returned — order cancelled`,
          referenceType: 'order',
          referenceId:   orderId,
        })
        .catch(() => undefined)
    }

    // Restock items when the order is cancelled — items that auto-disabled at 0
    // stock stay disabled until the restaurant re-enables (handled in MenuItemsService).
    if (dto.status === OrderStatus.CANCELLED) {
      for (const it of order.items) {
        this.menuItemsService
          .restock(it.menuItemId.toString(), it.quantity)
          .catch(() => undefined)
      }

      // Restore coupon slot — customer gets their per-user usage back on cancellation
      if (order.coupon?.code) {
        this.platformConfigService
          .revokeCouponUsage(orderId)
          .catch(() => undefined)
      }

      // Remove the scheduled release job if this was a scheduled order.
      // Without this the worker fires at scheduledFor and sends a ghost notification
      // to the restaurant for an already-cancelled order.
      if (updated.scheduledReleaseJobId) {
        this.scheduledOrderQueue
          .getJob(updated.scheduledReleaseJobId)
          .then((job) => job?.remove())
          .catch(() => undefined)
      }
    }

    // Side effects — fetch restaurant owner for targeted notifications
    const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
    const ownerId = restaurant.ownerId.toString()
    const customerId = order.customerId.toString()
    const orderIdStr = updated._id.toString()

    // Use allSettled so one failing side-effect doesn't silence the others.
    // Each failure is already logged inside the individual service methods.
    void Promise.allSettled([
      // Push notification to customer
      this.notificationsService.onOrderStatusChanged(
        customerId,
        updated.orderNumber,
        orderIdStr,
        dto.status,
      ),
      // Real-time socket update to customer + restaurant + order room
      this.trackingService.notifyOrderStatusUpdate(
        orderIdStr,
        customerId,
        ownerId,
        dto.status,
        updated.estimatedTime ?? undefined,
      ),
      // Dispatch on CONFIRMED (initial), and re-dispatch on READY if still no rider
      // (covers the case where the restaurant marks food ready before a rider accepted)
      dto.status === OrderStatus.CONFIRMED ||
      (dto.status === OrderStatus.READY && !updated.riderId)
        ? this.riderDispatchQueue.add('dispatch', {
            orderId: orderIdStr,
            lng: updated.deliveryAddress.coordinates.coordinates[0],
            lat: updated.deliveryAddress.coordinates.coordinates[1],
          })
        : Promise.resolve(),
      // On delivery: free up the rider and credit earnings
      dto.status === OrderStatus.DELIVERED && updated.riderId
        ? this.ridersService.onDeliveryComplete(
            String(updated.riderId),
            updated.pricing.deliveryFee + (updated.pricing.tip ?? 0),
          )
        : Promise.resolve(),
      // On cancellation: release the assigned rider (no earnings, no delivery count increment)
      dto.status === OrderStatus.CANCELLED && updated.riderId
        ? this.ridersService.releaseRider(String(updated.riderId))
        : Promise.resolve(),
      // On READY: push + socket to assigned rider so they know to go pick up the food
      dto.status === OrderStatus.READY && updated.riderId
        ? this.ridersService.getUserIdByRiderId(String(updated.riderId))
            .then((riderUserId) => {
              if (!riderUserId) return
              this.trackingService.notifyRiderOrderReady(riderUserId, orderIdStr)
              return this.notificationsService.onOrderReady(riderUserId, updated.orderNumber, orderIdStr)
            })
        : Promise.resolve(),
    ])

    return updated
  }

  private async assertTransitionPermission(
    order: OrderDocument,
    dto: UpdateOrderStatusDto,
    requester: JwtPayload,
  ): Promise<void> {
    const allowed = ALLOWED_TRANSITIONS[order.status]
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${dto.status}"`,
      )
    }

    // Approve if ANY of the requester's roles authorize this transition.
    // Users may legitimately carry multiple roles (e.g. customer who later
    // became a restaurant owner) — block only if none of them grants access.

    if (requester.roles.includes(UserRole.SUPER_ADMIN)) return

    if (requester.roles.includes(UserRole.RESTAURANT_OWNER)) {
      const restaurantAllowed: OrderStatus[] = [
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.CANCELLED,
      ]
      if (restaurantAllowed.includes(dto.status)) {
        const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
        if (restaurant.ownerId.toString() === requester.sub) return
      }
    }

    if (requester.roles.includes(UserRole.RIDER)) {
      const riderAllowed: OrderStatus[] = [OrderStatus.PICKED_UP, OrderStatus.DELIVERED]
      if (riderAllowed.includes(dto.status)) {
        try {
          const riderProfile = await this.ridersService.getProfile(requester.sub)
          if (order.riderId?.toString() === (riderProfile._id as Types.ObjectId).toString()) return
        } catch {
          // Rider profile not found — falls through to ForbiddenException below
        }
      }
    }

    if (requester.roles.includes(UserRole.CUSTOMER)) {
      if (
        dto.status === OrderStatus.CANCELLED &&
        order.customerId.toString() === requester.sub &&
        order.status === OrderStatus.PENDING
      ) {
        return
      }
    }

    throw new ForbiddenException('You are not permitted to make this transition.')
  }

  // ── Admin ────────────────────────────────────────────────────────

  async getAdminOrders(
    query: QueryOrdersDto,
  ): Promise<{ data: OrderDocument[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const filter: Record<string, unknown> = { systemClearedAt: null }
    if (query.status) filter.status = query.status

    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orderModel.countDocuments(filter),
    ])
    return { data: data as unknown as OrderDocument[], meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  async getOrderById(orderId: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')
    const order = await this.orderModel.findById(orderId).lean()
    if (!order) throw new NotFoundException('Order not found')
    return order as unknown as OrderDocument
  }

  async getOrderByIdForOwner(orderId: string, requester: JwtPayload): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')
    if (requester.roles.includes(UserRole.SUPER_ADMIN)) {
      return this.getOrderById(orderId)
    }
    // Restaurant owner: verify order belongs to one of their restaurants
    const restaurants = await this.restaurantsService.findByOwner(requester.sub)
    const restaurantIds = restaurants.map((r) => String(r._id))
    const order = await this.orderModel.findById(orderId).lean()
    if (!order) throw new NotFoundException('Order not found')
    if (!restaurantIds.includes(order.restaurantId.toString())) {
      throw new NotFoundException('Order not found')
    }
    return order as unknown as OrderDocument
  }

  // ── Used by PaymentsService ───────────────────────────────────────

  async markPaymentComplete(orderId: string, reference: string): Promise<OrderDocument> {
    const order = await this.orderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: OrderStatus.CONFIRMED,
          'payment.status': PaymentStatus.COMPLETED,
          'payment.reference': reference,
          'payment.paidAt': new Date(),
        },
      },
      { new: true },
    )
    if (!order) throw new NotFoundException('Order not found')

    // Payment confirmed — NOW notify the restaurant and dispatch a rider.
    // This is the correct trigger point: Paystack webhook → charge.success → here.
    const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
    const ownerId = restaurant.ownerId.toString()

    Promise.all([
      this.trackingService.notifyNewOrder(ownerId, order),
      this.riderDispatchQueue.add('dispatch', {
        orderId,
        lat: order.deliveryAddress.coordinates.coordinates[1],
        lng: order.deliveryAddress.coordinates.coordinates[0],
      }),
    ]).catch(() => undefined)

    return order
  }

  async markPaymentFailed(orderId: string): Promise<void> {
    await this.orderModel.findByIdAndUpdate(orderId, {
      $set: { 'payment.status': PaymentStatus.FAILED },
    })
  }

  // ── Rider contact for tap-to-call (customer/restaurant) ──────────

  async getRiderContactForOrder(
    orderId: string,
    requester: JwtPayload,
  ): Promise<{
    riderId: string
    firstName: string
    lastName: string
    phone: string | null
    vehicleType: string | null
    vehiclePlate: string | null
  }> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')

    const order = await this.orderModel.findById(orderId).lean()
    if (!order) throw new NotFoundException('Order not found')
    if (!order.riderId) throw new NotFoundException('No rider has been assigned to this order yet')

    // Authorization: customer of the order, restaurant owner, or super_admin
    const isAdmin = requester.roles.includes(UserRole.SUPER_ADMIN)
    const isCustomer = order.customerId.toString() === requester.sub
    let isOwner = false
    if (requester.roles.includes(UserRole.RESTAURANT_OWNER)) {
      const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
      isOwner = restaurant.ownerId.toString() === requester.sub
    }
    if (!isAdmin && !isCustomer && !isOwner) {
      throw new ForbiddenException('You do not have access to this order')
    }

    // Look up rider via service — returns populated userId with name+phone
    const profile = await this.ridersService.getProfileById(order.riderId.toString())
    const userInfo = profile['userId'] as {
      _id: Types.ObjectId
      firstName: string
      lastName: string
      phone: string | null
    }
    if (!userInfo) throw new NotFoundException('Rider account not found')

    return {
      riderId: order.riderId.toString(),
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      phone: userInfo.phone ?? null,
      vehicleType: (profile['vehicleType'] as string) ?? null,
      vehiclePlate: (profile['vehiclePlate'] as string | null) ?? null,
    }
  }

  // ── Used by RidersService ─────────────────────────────────────────

  async assignRider(orderId: string, riderId: string, riderUserId: string): Promise<OrderDocument> {
    // Atomic: only assign if no rider yet — prevents two riders accepting the same broadcast job
    const order = await this.orderModel.findOneAndUpdate(
      { _id: new Types.ObjectId(orderId), riderId: null },
      { $set: { riderId: new Types.ObjectId(riderId) } },
      { new: true },
    )
    if (!order) {
      // Either order doesn't exist or was already taken by another rider
      const exists = await this.orderModel.exists({ _id: new Types.ObjectId(orderId) })
      if (!exists) throw new NotFoundException('Order not found')
      throw new ConflictException('This order has already been accepted by another rider')
    }

    const customerId = order.customerId.toString()
    const orderIdStr = order._id.toString()
    // Look up the restaurant owner so we can push the assignment back to the kitchen.
    const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
    const ownerId = restaurant.ownerId.toString()

    Promise.all([
      this.notificationsService.onRiderAssigned(riderUserId, order.orderNumber, orderIdStr),
      // Push + SMS to restaurant: "Rider X is on the way, have it ready"
      // This fires even if no one has the admin dashboard open.
      this.notificationsService.onRiderComingToPickup(ownerId, riderUserId, order.orderNumber, orderIdStr),
      this.trackingService.notifyRiderNewJob(riderUserId, order),
      // Tell the customer + restaurant their "Searching for rider" banner can flip to "Rider on the way"
      this.trackingService.notifyOrderStatusUpdate(orderIdStr, customerId, ownerId, order.status, order.estimatedTime ?? undefined),
      // Richer payload so dashboards can populate the rider chip without an extra fetch
      this.trackingService.notifyRiderAssigned(ownerId, customerId, {
        orderId: orderIdStr,
        riderId,
        riderUserId,
      }),
    ]).catch(() => undefined)

    return order
  }

  // ── Used by TrackingGateway (removed — orderId now comes from client) ──

  async findActiveOrderByRider(riderId: string): Promise<OrderDocument | null> {
    return this.orderModel
      .findOne({
        riderId: new Types.ObjectId(riderId),
        status: { $in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP] },
        systemClearedAt: null,
      })
      .lean() as unknown as OrderDocument | null
  }

  async getAvailableOrders(excludeUserId?: string): Promise<OrderDocument[]> {
    // Only show broadcast jobs from the last 45 minutes — prevents stale orders cluttering the rider's list
    const cutoff = new Date(Date.now() - 45 * 60 * 1000)
    const filter: Record<string, unknown> = {
      riderId: null,
      status: { $in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
      createdAt: { $gte: cutoff },
      systemClearedAt: null,
    }
    if (excludeUserId) {
      filter['declinedBy'] = { $nin: [new Types.ObjectId(excludeUserId)] }
    }
    return this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean() as unknown as OrderDocument[]
  }

  async recordDecline(orderId: string, userId: string): Promise<void> {
    await this.orderModel.updateOne(
      { _id: new Types.ObjectId(orderId) },
      { $addToSet: { declinedBy: new Types.ObjectId(userId) } },
    )
  }

  // Re-enqueue dispatch for any recent unassigned orders — called when a rider comes online
  // so orders that exhausted their original dispatch cycle get another shot.
  async redispatchUnassigned(): Promise<void> {
    const orders = await this.getAvailableOrders()
    if (orders.length === 0) return

    await Promise.allSettled(
      orders.map((o) =>
        this.riderDispatchQueue.add('dispatch', {
          orderId: String(o._id),
          lng: o.deliveryAddress.coordinates.coordinates[0],
          lat: o.deliveryAddress.coordinates.coordinates[1],
        }),
      ),
    )
  }

  async getRiderDeliveries(
    riderId: string,
    query: QueryOrdersDto,
  ): Promise<{ data: OrderDocument[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.orderModel
        .find({ riderId: new Types.ObjectId(riderId), status: OrderStatus.DELIVERED, systemClearedAt: null })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.orderModel.countDocuments({ riderId: new Types.ObjectId(riderId), status: OrderStatus.DELIVERED, systemClearedAt: null }),
    ])
    return { data: data as unknown as OrderDocument[], meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  // Aggregate performance metrics for a rider over the given window (defaults to all-time).
  // Acceptance rate is omitted — we don't currently track "offered but declined" events.
  async getRiderMetrics(riderId: string, sinceDays?: number): Promise<{
    deliveriesCount:     number
    cancelledCount:      number
    cancellationRate:    number  // 0..1
    onTimeCount:         number
    onTimeRate:          number  // 0..1
    avgDeliveryMinutes:  number  // pickup-to-delivery
  }> {
    const filter: Record<string, unknown> = {
      riderId: new Types.ObjectId(riderId),
    }
    if (sinceDays && sinceDays > 0) {
      filter.createdAt = { $gte: new Date(Date.now() - sinceDays * 86_400_000) }
    }

    // Pull only the fields we need — keeps the lean docs tiny.
    const orders = await this.orderModel.find(
      filter,
      { status: 1, createdAt: 1, actualDeliveryAt: 1, estimatedTime: 1 },
    ).lean() as Array<{
      status:           string
      createdAt:        Date
      actualDeliveryAt: Date | null
      estimatedTime:    number | null
    }>

    const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED && o.actualDeliveryAt)
    const cancelled = orders.filter((o) => o.status === OrderStatus.CANCELLED).length
    const assigned  = orders.length

    let onTimeCount      = 0
    let totalDeliveryMin = 0
    for (const o of delivered) {
      const created   = new Date(o.createdAt).getTime()
      const delivered = new Date(o.actualDeliveryAt!).getTime()
      const minutes   = (delivered - created) / 60_000
      totalDeliveryMin += minutes
      if (o.estimatedTime && minutes <= o.estimatedTime) onTimeCount++
    }

    return {
      deliveriesCount:    delivered.length,
      cancelledCount:     cancelled,
      cancellationRate:   assigned > 0 ? cancelled / assigned : 0,
      onTimeCount,
      onTimeRate:         delivered.length > 0 ? onTimeCount / delivered.length : 0,
      avgDeliveryMinutes: delivered.length > 0 ? Math.round(totalDeliveryMin / delivered.length) : 0,
    }
  }

  // ── Called by OrderTimeoutProcessor ──────────────────────────────

  // Fired by the scheduled-order worker `prep buffer` minutes before scheduledFor.
  // Notifies the restaurant so the order enters their live queue. Idempotent —
  // if the order was cancelled in the meantime we silently no-op.
  async releaseScheduledOrder(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) return
    const order = await this.orderModel.findById(orderId).exec()
    if (!order) return
    if (order.status !== OrderStatus.PENDING) return
    if (!order.scheduledFor) return

    const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
    const ownerId = restaurant.ownerId.toString()

    const customerId = order.customerId.toString()

    // Notify restaurant (same path as an immediate order)
    this.notificationsService
      .onOrderPlaced(customerId, ownerId, order.orderNumber, orderId)
      .catch(() => undefined)

    this.trackingService.notifyNewOrder(ownerId, order)

    // Notify customer their scheduled order is now being sent to the restaurant
    this.notificationsService
      .onOrderStatusChanged(customerId, order.orderNumber, orderId, OrderStatus.PENDING)
      .catch(() => undefined)
    this.trackingService.notifyOrderStatusUpdate(
      orderId, customerId, ownerId, OrderStatus.PENDING, order.estimatedTime ?? undefined,
    )
  }

  async cancelIfTimedOut(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) return

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      status: OrderStatus.PENDING,
      'payment.status': PaymentStatus.PENDING,
    })
    if (!order) return // Already confirmed or cancelled — nothing to do

    const cancelled = await this.orderModel.findByIdAndUpdate(orderId, {
      $set: {
        status: OrderStatus.CANCELLED,
        cancelReason: 'Payment timeout — order auto-cancelled after 15 minutes',
      },
    }, { new: true })

    if (!cancelled) return

    // Remove the scheduled release job so the restaurant never receives a ghost notification
    if (cancelled.scheduledReleaseJobId) {
      this.scheduledOrderQueue
        .getJob(cancelled.scheduledReleaseJobId)
        .then((job) => job?.remove())
        .catch(() => undefined)
    }

    const customerId = order.customerId.toString()
    this.notificationsService
      .onOrderStatusChanged(customerId, order.orderNumber, orderId, OrderStatus.CANCELLED)
      .catch(() => undefined)

    // Also notify the restaurant owner so they don't keep a slot open for a ghost order
    try {
      const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
      this.notificationsService
        .onOrderStatusChanged(restaurant.ownerId.toString(), order.orderNumber, orderId, OrderStatus.CANCELLED)
        .catch(() => undefined)
    } catch {
      // Non-critical — customer was already notified
    }
  }
}
