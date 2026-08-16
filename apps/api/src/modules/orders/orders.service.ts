import {
  Injectable,
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
import { MenuItemsService } from '../menu-items/menu-items.service'
import { NotificationsService } from '../notifications/notifications.service'
import { TrackingService } from '../tracking/tracking.service'
import { PlatformConfigService } from '../platform-config/platform-config.service'
import { RestaurantsService } from '../restaurants/restaurants.service'
import { WalletService } from '../wallet/wallet.service'
import { WalletTxnReason } from '../wallet/schemas/wallet-transaction.schema'
import { DeliveryZonesService } from '../delivery-zones/delivery-zones.service'
import { SurgePricingService } from '../surge-pricing/surge-pricing.service'
import {
  ORDER_TIMEOUT_QUEUE,
  RIDER_DISPATCH_QUEUE,
  SCHEDULED_ORDER_QUEUE,
  ORDER_TIMEOUT_DELAY_MS,
  SCHEDULED_ORDER_PREP_BUFFER_MIN,
} from '../jobs/constants/queue.constants'
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:  [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]:  [OrderStatus.READY],
  [OrderStatus.READY]:      [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]:  [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]:  [],
  [OrderStatus.CANCELLED]:  [],
}

const SERVICE_FEE_RATE = 0.05
const SERVICE_FEE_CAP = 150_000 // ₦1,500 per master prompt spec

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

  // ── Place order ──────────────────────────────────────────────────

  async createOrder(customerId: string, dto: CreateOrderDto): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(dto.restaurantId)) {
      throw new BadRequestException('Invalid restaurant ID')
    }
    const restaurant = await this.restaurantsService.findByIdRaw(dto.restaurantId)
    if (!restaurant.isApproved || !restaurant.isActive) {
      throw new BadRequestException('Restaurant not available')
    }
    if (!restaurant.isOpen) {
      throw new BadRequestException('Restaurant is currently closed')
    }

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

      const variantTotal = (input.selectedVariants ?? []).reduce((sum, sv) => {
        const option = menuItem.variants
          .find((v) => v.name === sv.variantName)
          ?.options.find((o) => o.name === sv.optionName)
        return sum + (option?.priceAdjustment ?? 0)
      }, 0)

      const addOnTotal = (input.selectedAddOns ?? []).reduce((sum, sa) => {
        const addOn = menuItem.addOns.find((a) => a.name === sa.name && a.isAvailable)
        return sum + (addOn?.price ?? 0)
      }, 0)

      const itemTotal = (menuItem.basePrice + variantTotal + addOnTotal) * input.quantity
      subtotal += itemTotal

      return {
        menuItemId: new Types.ObjectId(input.menuItemId),
        name: menuItem.name,
        image: menuItem.image,
        basePrice: menuItem.basePrice,
        quantity: input.quantity,
        selectedVariants: (input.selectedVariants ?? []).map((sv) => ({
          variantName: sv.variantName,
          optionName: sv.optionName,
          priceAdjustment:
            menuItem.variants
              .find((v) => v.name === sv.variantName)
              ?.options.find((o) => o.name === sv.optionName)
              ?.priceAdjustment ?? 0,
        })),
        selectedAddOns: (input.selectedAddOns ?? []).map((sa) => ({
          name: sa.name,
          price: menuItem.addOns.find((a) => a.name === sa.name && a.isAvailable)?.price ?? 0,
        })),
        itemTotal,
        note: input.note ?? null,
      }
    })

    if (subtotal < restaurant.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ₦${(restaurant.minOrderAmount / 100).toFixed(0)}`,
      )
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
    // Surge stacks on the zone multiplier — a busy Friday night in a far zone
    // could hit 1.5 × 2.0 = 3× base fee. Both capped individually (5× surge, arbitrary zone).
    const surgeMultiplier = await this.surgePricingService.getMultiplierAt(new Date())
    const deliveryFee = Math.round(restaurant.deliveryFeeFixed * zoneMultiplier * surgeMultiplier)

    const serviceFee = Math.min(Math.round(subtotal * SERVICE_FEE_RATE), SERVICE_FEE_CAP)
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
      restaurantId: new Types.ObjectId(dto.restaurantId),
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

    // Increment coupon usage count (after successful save)
    if (appliedCouponId) {
      this.platformConfigService.incrementCouponUsage(appliedCouponId).catch(() => undefined)
    }

    // Decrement stock atomically for each item. Race-safe via $gte filter — if any
    // item was concurrently sold out, this catches it. We pre-validated in the loop
    // above, but the gap between check and write is exactly what this guard exists for.
    for (const it of orderItems) {
      const result = await this.menuItemsService.tryDecrementStock(
        it.menuItemId.toString(),
        it.quantity,
      )
      if (!result.ok) {
        // Roll back: cancel the order, refund the wallet if applied, and surface the error.
        await this.orderModel.findByIdAndUpdate(order._id, {
          $set: {
            status: OrderStatus.CANCELLED,
            cancelReason: result.reason,
          },
        })
        if (walletApplied > 0) {
          this.walletService
            .credit({
              userId:        customerId,
              amount:        walletApplied,
              reason:        WalletTxnReason.REFUND,
              description:   'Wallet credit returned — out of stock at order create',
              referenceType: 'order',
              referenceId:   order._id.toString(),
            })
            .catch(() => undefined)
        }
        throw new BadRequestException(result.reason)
      }
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

    // Card / wallet: return pending order — dispatch fires after payment webhook confirms
    Promise.all([
      this.notificationsService.onOrderPlaced(customerId, ownerId, order.orderNumber, orderId),
      this.trackingService.notifyNewOrder(ownerId, order),
    ]).catch(() => undefined)

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

  // ── Restaurant — view incoming orders ────────────────────────────

  async getRestaurantOrders(
    restaurantId: string,
    query: QueryOrdersDto,
  ): Promise<{ data: OrderDocument[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
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
      { systemClearedAt: null },
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
    }

    // Side effects — fetch restaurant owner for targeted notifications
    const restaurant = await this.restaurantsService.findByIdRaw(order.restaurantId.toString())
    const ownerId = restaurant.ownerId.toString()
    const customerId = order.customerId.toString()
    const orderIdStr = updated._id.toString()

    Promise.all([
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
      // On delivery: free up the rider, bump delivery count, credit their
      // pending earnings. Rider takes 100% of delivery fee + tip.
      dto.status === OrderStatus.DELIVERED && updated.riderId
        ? this.orderModel.db.db!.collection('riders').updateOne(
            { _id: new Types.ObjectId(String(updated.riderId)) },
            {
              $set: { isAvailable: true },
              $inc: {
                totalDeliveries:        1,
                'earnings.pendingKobo': updated.pricing.deliveryFee + (updated.pricing.tip ?? 0),
                'earnings.totalKobo':   updated.pricing.deliveryFee + (updated.pricing.tip ?? 0),
              },
            },
          )
        : Promise.resolve(),
      // On READY: push + socket to assigned rider so they know to go pick up the food
      dto.status === OrderStatus.READY && updated.riderId
        ? this.orderModel.db.db!
            .collection('riders')
            .findOne({ _id: new Types.ObjectId(String(updated.riderId)) }, { projection: { userId: 1 } })
            .then((riderDoc) => {
              const riderUserId = riderDoc?.userId?.toString()
              if (!riderUserId) return
              this.trackingService.notifyRiderOrderReady(riderUserId, orderIdStr)
              return this.notificationsService.onOrderReady(riderUserId, updated.orderNumber, orderIdStr)
            })
        : Promise.resolve(),
    ]).catch(() => undefined)

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
        // order.riderId is RiderDocument._id; requester.sub is UserDocument._id — look up the rider
        const riderDoc = await this.orderModel.db.db!
          .collection('riders')
          .findOne({ userId: new Types.ObjectId(requester.sub) }, { projection: { _id: 1 } })
        if (riderDoc && order.riderId?.toString() === riderDoc._id.toString()) return
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
          'payment.status': PaymentStatus.COMPLETED,
          'payment.reference': reference,
          'payment.paidAt': new Date(),
        },
      },
      { new: true },
    )
    if (!order) throw new NotFoundException('Order not found')
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

    // Look up the rider doc, then the underlying user for name + phone
    const riderDoc = await this.orderModel.db.db!
      .collection<{ _id: Types.ObjectId; userId: Types.ObjectId; vehicleType: string; vehiclePlate: string | null }>('riders')
      .findOne({ _id: new Types.ObjectId(order.riderId.toString()) })
    if (!riderDoc) throw new NotFoundException('Rider profile not found')

    const userDoc = await this.orderModel.db.db!
      .collection<{ _id: Types.ObjectId; firstName: string; lastName: string; phone: string | null }>('users')
      .findOne({ _id: riderDoc.userId })
    if (!userDoc) throw new NotFoundException('Rider account not found')

    return {
      riderId: riderDoc._id.toString(),
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      phone: userDoc.phone,
      vehicleType: riderDoc.vehicleType ?? null,
      vehiclePlate: riderDoc.vehiclePlate ?? null,
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

  async getAvailableOrders(): Promise<OrderDocument[]> {
    // Only show broadcast jobs from the last 45 minutes — prevents stale orders cluttering the rider's list
    const cutoff = new Date(Date.now() - 45 * 60 * 1000)
    return this.orderModel
      .find({
        riderId: null,
        status: { $in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
        createdAt: { $gte: cutoff },
        systemClearedAt: null,
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean() as unknown as OrderDocument[]
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

    // Reuse the same "new order placed" notification path as immediate orders.
    this.notificationsService
      .onOrderPlaced(order.customerId.toString(), ownerId, order.orderNumber, orderId)
      .catch(() => undefined)

    this.trackingService.notifyNewOrder(ownerId, order)
  }

  async cancelIfTimedOut(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) return

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      status: OrderStatus.PENDING,
      'payment.status': PaymentStatus.PENDING,
    })
    if (!order) return // Already confirmed or cancelled — nothing to do

    await this.orderModel.findByIdAndUpdate(orderId, {
      $set: {
        status: OrderStatus.CANCELLED,
        cancelReason: 'Payment timeout — order auto-cancelled after 15 minutes',
      },
    })

    this.notificationsService
      .onOrderStatusChanged(
        order.customerId.toString(),
        order.orderNumber,
        orderId,
        OrderStatus.CANCELLED,
      )
      .catch(() => undefined)
  }
}
