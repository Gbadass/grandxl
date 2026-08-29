import {
  Injectable,
  Inject,
  Logger,
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
import { CANCEL_REASON_TEXT, type UpdateOrderStatusDto } from './dto/update-order-status.dto'
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
import { PaymentsService } from '../payments/payments.service'
import { ReferralsService } from '../referrals/referrals.service'
import { SideEffectsService } from '../side-effects/side-effects.service'
import { SideEffectType } from '../side-effects/schemas/pending-side-effect.schema'
import {
  ORDER_TIMEOUT_QUEUE,
  RIDER_DISPATCH_QUEUE,
  SCHEDULED_ORDER_QUEUE,
  DISPATCH_ESCALATION_QUEUE,
  DISPATCH_ESCALATION_DELAY_MS,
  ORDER_TIMEOUT_DELAY_MS,
  SCHEDULED_ORDER_PREP_BUFFER_MIN,
} from '../jobs/constants/queue.constants'
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'
import { MAX_ORDER_VALUE_KOBO } from '../../common/constants/app.constants'
import { isRestaurantOpen, formatMoney, calculateDistance } from '@grandxl/utils'
import type { RestaurantHours, RestaurantSpecialHours } from '@grandxl/utils'

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  // PICKED_UP allowed from CONFIRMED — rider can confirm pickup even if the
  // restaurant never acknowledged the order in their portal (common in practice).
  [OrderStatus.CONFIRMED]:  [OrderStatus.PREPARING, OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  // PICKED_UP allowed directly from PREPARING — rider can confirm pickup without
  // waiting for the restaurant to mark READY (handles unattended restaurant screens).
  [OrderStatus.PREPARING]:  [OrderStatus.READY, OrderStatus.PICKED_UP],
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
  private readonly logger = new Logger(OrdersService.name)

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
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly referralsService: ReferralsService,
    private readonly sideEffects: SideEffectsService,
    @InjectQueue(ORDER_TIMEOUT_QUEUE) private readonly orderTimeoutQueue: Queue,
    @InjectQueue(RIDER_DISPATCH_QUEUE) private readonly riderDispatchQueue: Queue,
    @InjectQueue(SCHEDULED_ORDER_QUEUE) private readonly scheduledOrderQueue: Queue,
    // S-URGENT (Nigerian ack flow): 90s dispatch escalation timer
    @InjectQueue(DISPATCH_ESCALATION_QUEUE) private readonly dispatchEscalationQueue: Queue,
  ) {}

  // ── S-URGENT: dispatch trigger helpers ────────────────────────────
  //
  // The Nigerian flow needs two separate dispatch triggers:
  //   1. Restaurant tapped Accept  → fire immediate dispatch, cancel escalation.
  //      This is the fast path — kitchen knows, rider goes.
  //   2. Restaurant didn't tap after 90s → escalation timer fires, marks
  //      `dispatchedWithoutRestaurantAck: true`, fires dispatch anyway.
  //      Prevents customer orders from stalling on a snoozing restaurant.
  //
  // Both share these two helpers so all four dispatch trigger sites in this
  // file route through the same code path — no drift.

  private async scheduleDispatchEscalation(orderId: string, lat: number, lng: number): Promise<void> {
    // jobId keyed on orderId so restaurant Accept can remove it via
    // queue.remove(jobId) — no more escalation once the restaurant engages.
    // Idempotent: enqueuing twice returns the existing job unchanged.
    await this.dispatchEscalationQueue
      .add('escalate', { orderId, lat, lng }, {
        jobId: `escalation-${orderId}`,
        delay: DISPATCH_ESCALATION_DELAY_MS,
      })
      .catch((err) => this.logger.warn(`Could not schedule dispatch escalation for order ${orderId}: ${String(err)}`))
  }

  private async cancelDispatchEscalation(orderId: string): Promise<void> {
    await this.dispatchEscalationQueue.remove(`escalation-${orderId}`).catch(() => undefined)
  }

  private async fireDispatchNow(orderId: string, lat: number, lng: number): Promise<void> {
    // Route through SideEffects: if Redis is momentarily unavailable, the primary
    // enqueue fails, the intent is persisted, and the SideEffects sweeper retries
    // on backoff with a DLQ after MAX_ATTEMPTS. Silent fire-and-forget would leave
    // a paid, restaurant-acked order with no rider ever dispatched.
    // BullMQ jobId `dispatch-${orderId}` still dedupes primary + retry paths.
    await this.sideEffects.tryOrEnqueue(
      SideEffectType.DISPATCH_ORDER,
      `dispatch:${orderId}`,
      { orderId, lat, lng },
      () => this.riderDispatchQueue
        .add('dispatch', { orderId, lat, lng }, { jobId: `dispatch-${orderId}` })
        .then(() => undefined),
    )
  }

  // Called by the 90s escalation processor. Idempotent guards ensure we only
  // fire dispatch (and stamp the flag) if the restaurant genuinely never
  // engaged and there's no rider yet.
  async escalateDispatchIfNeeded(orderId: string, lat: number, lng: number): Promise<void> {
    const order = await this.orderModel.findById(orderId, {
      status: 1, riderId: 1, restaurantAckedAt: 1, dispatchedWithoutRestaurantAck: 1,
    }).lean() as unknown as {
      status: OrderStatus; riderId: Types.ObjectId | null
      restaurantAckedAt: Date | null; dispatchedWithoutRestaurantAck: boolean
    } | null
    if (!order) return
    if (order.status !== OrderStatus.CONFIRMED) return  // already moved past — skip
    if (order.riderId)                          return  // rider already accepted — skip
    if (order.restaurantAckedAt)                return  // restaurant engaged inside the window — skip
    if (order.dispatchedWithoutRestaurantAck)   return  // already fired — dedupe

    await this.orderModel.updateOne(
      { _id: new Types.ObjectId(orderId), restaurantAckedAt: null, riderId: null },
      { $set: { dispatchedWithoutRestaurantAck: true } },
    )
    this.logger.warn(`Order ${orderId} — restaurant didn't engage in 90s, dispatching anyway (rider will drive it)`)
    await this.fireDispatchNow(orderId, lat, lng)
  }

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
    // Sprint 12 (S12-11): distance + radius signalling so the client can render
    // the far-delivery warning card + acknowledgement checkbox before placement.
    deliveryDistanceKm:   number | null
    restaurantRadiusKm:   number
    isFarDelivery:        boolean
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

    // Sprint 12 (S12-11): straight-line distance restaurant → customer. Uses the
    // same haversine helper as elsewhere in the codebase; ~1km accuracy at Lagos
    // latitudes, plenty for a radius check that's already fuzzy.
    const restaurantRadiusKm = restaurant.deliveryRadius ?? 0
    const restaurantCoords = restaurant.address?.coordinates?.coordinates as [number, number] | undefined
    const deliveryDistanceKm = restaurantCoords
      ? Math.round(calculateDistance(
          { lat: restaurantCoords[1], lng: restaurantCoords[0] },
          { lat: dto.deliveryAddress.coordinates.lat, lng: dto.deliveryAddress.coordinates.lng },
        ) * 10) / 10
      : null
    const isFarDelivery =
      restaurantRadiusKm > 0 &&
      deliveryDistanceKm !== null &&
      deliveryDistanceKm > restaurantRadiusKm

    return {
      subtotal,
      deliveryFee: effectiveDeliveryFee,
      serviceFee,
      discount,
      total,
      surgeMultiplier,
      currency: restaurant.currency,
      isFirstOrder: false,
      deliveryDistanceKm,
      restaurantRadiusKm,
      isFarDelivery,
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

    // Sprint 12 (S12-11): per-restaurant delivery radius. Compute straight-line
    // distance; if beyond the restaurant's radius the customer must have opted-in
    // via `farDeliveryAcknowledged` (the checkout page prompts for it after the
    // estimate call flags the situation). radius === 0 disables the check so
    // restaurants that lean purely on the zone map behave as before.
    const restaurantRadiusKm = restaurant.deliveryRadius ?? 0
    const restaurantCoords = restaurant.address?.coordinates?.coordinates as [number, number] | undefined
    const deliveryDistanceKm = restaurantCoords
      ? Math.round(calculateDistance(
          { lat: restaurantCoords[1], lng: restaurantCoords[0] },
          { lat: dto.deliveryAddress.coordinates.lat, lng: dto.deliveryAddress.coordinates.lng },
        ) * 10) / 10
      : null
    const beyondRadius =
      restaurantRadiusKm > 0 &&
      deliveryDistanceKm !== null &&
      deliveryDistanceKm > restaurantRadiusKm
    if (beyondRadius && !dto.farDeliveryAcknowledged) {
      throw new BadRequestException(
        `This address is ${deliveryDistanceKm} km from the restaurant — outside their ${restaurantRadiusKm} km normal range. Please acknowledge and retry.`,
      )
    }
    const isFarDelivery = beyondRadius === true
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
      const tz = (restaurant as unknown as { timezone?: string }).timezone ?? 'Africa/Lagos'
      // Sprint 12 (S12-10): pass specialHours so date-specific overrides gate
      // scheduled orders too — a customer can't schedule for Christmas Day if
      // the restaurant marked it closed.
      const specialHours = (restaurant as unknown as { specialHours?: RestaurantSpecialHours }).specialHours
      if (restaurant.openingHours && !isRestaurantOpen(restaurant.openingHours as unknown as RestaurantHours, tz, when, specialHours)) {
        throw new BadRequestException('Restaurant will be closed at the scheduled time')
      }
      scheduledFor = when
    }

    const total = subtotal + (freeDelivery ? 0 : deliveryFee) + serviceFee - (freeDelivery ? 0 : discount) + vat + tip

    // Wallet application: atomically debit up to `total` kobo in a single DB op.
    // Using debitUpTo avoids the read-then-write race: two concurrent orders for
    // the same customer can no longer both pass a balance check and overdraft the wallet.
    // The actual amount debited is returned and used as walletApplied.
    let walletApplied = 0
    if (dto.useWallet) {
      const { actualDebited } = await this.walletService.debitUpTo({
        userId:        customerId,
        maxAmount:     total,
        reason:        WalletTxnReason.ORDER_PAYMENT,
        description:   `Applied to new order`,
        referenceType: 'order_pending',
        referenceId:   customerId, // overwritten once order has an id — see post-save patch below
      })
      walletApplied = actualDebited
    }

    let order: OrderDocument
    try {
      order = await new this.orderModel({
        orderNumber: await this.nextOrderNumber(),
        customerId: new Types.ObjectId(customerId),
        restaurantId:      new Types.ObjectId(dto.restaurantId),
        restaurantName:    restaurant.name,
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
        // Sprint 12 (S12-11): snapshot distance + far-delivery flag
        deliveryDistanceKm,
        isFarDelivery,
      }).save()
    } catch (saveErr) {
      // Wallet was already debited — refund it so the customer is not charged for a
      // failed order. We surface errors here rather than swallowing them: a silent
      // failure would mean the customer loses money with no recourse.
      if (walletApplied > 0) {
        await this.walletService.credit({
          userId:        customerId,
          amount:        walletApplied,
          reason:        WalletTxnReason.REFUND,
          description:   'Wallet refund — order could not be created',
          referenceType: 'order_pending',
          referenceId:   customerId,
        }).catch((refundErr: unknown) =>
          this.logger.error('CRITICAL: wallet refund failed after order save failure', refundErr)
        )
      }
      // Coupon slot was atomically reserved in validateCoupon — release it so the
      // customer can re-use the coupon. No usage record exists yet, so we decrement directly.
      if (appliedCouponId) {
        this.platformConfigService.releaseCouponSlot(appliedCouponId, customerId, undefined).catch(() => undefined)
      }
      throw saveErr
    }

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

        // Release the coupon slot directly — recordCouponUsage is fire-and-forget so the
        // usage record may not exist yet; pass orderId so any orphaned doc is also cleaned up.
        if (appliedCouponId) {
          this.platformConfigService
            .releaseCouponSlot(appliedCouponId, customerId, order._id.toString())
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

    // No-payment-gate confirm path. Two cases skip the payment webhook:
    //   1. Cash on delivery — payment happens at handover, not now.
    //   2. Wallet fully covered — walletApplied >= total means the order is
    //      already paid in full at create time; no Paystack round-trip needed.
    //      Without this branch, wallet-only orders sat at PENDING forever
    //      because markPaymentComplete (which handles the CONFIRMED transition
    //      and escalation) is only called by the Paystack webhook.
    // Dispatch is NOT fired here (S-URGENT / Nigerian ack flow) — it fires when
    // the restaurant taps Accept OR when the 90s escalation runs. Prevents
    // rider commit to food the kitchen hasn't been told about.
    const paidAtCreate = dto.paymentMethod === PaymentMethod.CASH || walletApplied >= total
    if (paidAtCreate) {
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

      // Scheduled orders defer escalation to releaseScheduledOrder — firing at
      // create time would kick a rider hours before scheduledFor.
      const escalationTask: Promise<unknown> = scheduledFor
        ? Promise.resolve()
        : this.scheduleDispatchEscalation(
            orderId,
            dto.deliveryAddress.coordinates.lat,
            dto.deliveryAddress.coordinates.lng,
          )

      Promise.all([
        this.notificationsService.onOrderPlaced(customerId, ownerId, confirmed.orderNumber, orderId),
        // Scheduled orders shouldn't buzz the restaurant now — release will do it.
        scheduledFor ? Promise.resolve() : this.trackingService.notifyNewOrder(ownerId, confirmed),
        escalationTask,
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
    await this.assertRiderProximity(order, dto, requester)
    this.assertCashConfirmationIfNeeded(order, dto, requester)

    const updates: Record<string, unknown> = { status: dto.status }
    if (dto.status === OrderStatus.CANCELLED) {
      updates.cancelReason = dto.cancelReason ?? CANCEL_REASON_TEXT[dto.cancelReasonCode ?? 'other']
      updates.cancelReasonCode = dto.cancelReasonCode ?? null
    }
    if (dto.status === OrderStatus.DELIVERED) {
      updates.actualDeliveryAt = new Date()
    }
    if (dto.status === OrderStatus.PICKED_UP) {
      updates.pickedUpAt = new Date()
    }
    if (dto.status === OrderStatus.DELIVERED && order.payment.method === PaymentMethod.CASH && dto.cashCollected) {
      updates.cashCollectedAt = new Date()
    }
    if (dto.status === OrderStatus.DELIVERED && dto.deliveryProofUrl) {
      updates.deliveryProofUrl = dto.deliveryProofUrl
    }
    // Engagement signals — set ONLY when the transition was driven by the restaurant
    // owner clicking Accept or Ready in their dashboard. Auto-confirm from the payment
    // webhook does not touch these fields; that's how we tell "engaged" from "passive".
    // The Accept button dispatches EITHER PENDING→CONFIRMED (webhook not landed yet)
    // OR CONFIRMED→PREPARING (webhook landed first) depending on race — both mean
    // "the restaurant physically clicked Accept", so both stamp restaurantConfirmedAt.
    // Explicitly exclude SUPER_ADMIN: an admin acting on behalf of a restaurant must
    // NOT inflate that restaurant's engagement rate — the human running the store
    // isn't the one clicking, so this wasn't engagement.
    const isRestaurantAction =
      requester.roles.includes(UserRole.RESTAURANT_OWNER) &&
      !requester.roles.includes(UserRole.SUPER_ADMIN)
    const isAcceptTransition =
      (order.status === OrderStatus.PENDING   && dto.status === OrderStatus.CONFIRMED) ||
      (order.status === OrderStatus.CONFIRMED && dto.status === OrderStatus.PREPARING)
    if (isRestaurantAction && isAcceptTransition && !order.restaurantConfirmedAt) {
      updates.restaurantConfirmedAt = new Date()
    }
    if (isRestaurantAction && dto.status === OrderStatus.READY && !order.restaurantReadyAt) {
      updates.restaurantReadyAt = new Date()
    }
    // S-URGENT (Nigerian ack flow): any restaurant-driven status change acks
    // the order. Broader than restaurantConfirmedAt (which is Accept-only for
    // engagement metrics). Used as the dispatch-escalation gate and to unlock
    // assignRider's auto-advance CONFIRMED→PREPARING.
    if (isRestaurantAction && !order.restaurantAckedAt) {
      updates.restaurantAckedAt = new Date()
    }

    // Use the current status as a filter so two concurrent transitions cannot both
    // silently succeed — only the first writer wins; the second gets a 409.
    const updated = await this.orderModel
      .findOneAndUpdate({ _id: orderId, status: order.status }, { $set: updates }, { new: true })
      .exec()
    if (!updated) throw new ConflictException('Order status was changed concurrently — please refresh and retry')

    // Refund wallet if order is cancelled and wallet was applied. Fire-and-forget;
    // failure here shouldn't roll back the cancellation but must be logged — a silent
    // failure means the customer loses money with no recourse.
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
        .catch((err: unknown) =>
          this.logger.error(`CRITICAL: wallet refund failed on cancellation of order ${orderId}`, err)
        )
    }

    // Initiate Paystack card refund if the order was paid by card. Fire-and-forget —
    // wallet has already been refunded above; a Paystack API hiccup must not block the
    // cancellation response. Log errors so ops can manually reconcile if Paystack fails.
    if (dto.status === OrderStatus.CANCELLED) {
      const cancelReason = dto.cancelReason ?? 'Order cancelled'
      this.paymentsService
        .initiateRefund(orderId, cancelReason)
        .catch((err: unknown) =>
          this.logger.error(`Paystack refund initiation failed for cancelled order ${orderId}`, err)
        )
    }

    // Restock items when the order is cancelled — items that auto-disabled at 0
    // stock stay disabled until the restaurant re-enables (handled in MenuItemsService).
    if (dto.status === OrderStatus.CANCELLED) {
      // S-URGENT: kill the 90s escalation timer so it doesn't fire dispatch
      // against a cancelled order. Without this, a rider could be dispatched
      // to pick up food that no longer exists — customer already refunded,
      // restaurant already informed, rider driven in vain.
      void this.cancelDispatchEscalation(orderId)

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
      // S-URGENT (Nigerian ack flow): dispatch triggers.
      //
      // Only two cases fire immediate dispatch through this path:
      //  a) The restaurant ACKED the order via any status transition — cancel
      //     the 90s escalation and dispatch NOW. Kitchen knows, rider goes.
      //  b) READY status on an order with no rider yet — restaurant marked
      //     ready and there's still no rider (rare). Fire dispatch to salvage.
      //
      // Payment-webhook-driven CONFIRMED transitions no longer fire dispatch
      // here — they schedule the escalation via markPaymentComplete instead.
      isRestaurantAction && !order.restaurantAckedAt
        ? Promise.all([
            this.cancelDispatchEscalation(orderIdStr),
            this.fireDispatchNow(
              orderIdStr,
              updated.deliveryAddress.coordinates.coordinates[1],
              updated.deliveryAddress.coordinates.coordinates[0],
            ),
          ])
        : (dto.status === OrderStatus.READY && !updated.riderId
            ? this.fireDispatchNow(
                orderIdStr,
                updated.deliveryAddress.coordinates.coordinates[1],
                updated.deliveryAddress.coordinates.coordinates[0],
              )
            : Promise.resolve()),
      // On delivery: free up the rider and credit earnings
      dto.status === OrderStatus.DELIVERED && updated.riderId
        ? this.ridersService.onDeliveryComplete(
            String(updated.riderId),
            updated.pricing.deliveryFee + (updated.pricing.tip ?? 0),
          )
        : Promise.resolve(),
      // Sprint 12 (S12-6): on delivery, also credit the restaurant's pending
      // earnings so the payouts page reflects money owed in real time. Same 24h
      // hold as riders — settlement moves pending → total. Net = subtotal − discount,
      // matching the model the Finance page (S12-5) uses.
      dto.status === OrderStatus.DELIVERED
        ? this.restaurantsService.onDeliveryComplete(
            String(updated.restaurantId),
            Math.max(0, updated.pricing.subtotal - (updated.pricing.discount ?? 0)),
          )
        : Promise.resolve(),
      // On cancellation: release the assigned rider. Auto-heal in acceptOrder self-corrects
      // a missed release eventually, but that leaves the rider locked out of new jobs in the
      // meantime — real earnings loss. Route through SideEffects so a transient failure
      // gets a durable retry instead of just a log line.
      dto.status === OrderStatus.CANCELLED && updated.riderId
        ? this.sideEffects.tryOrEnqueue(
            SideEffectType.RELEASE_RIDER,
            `release-rider:${orderIdStr}`,
            { riderId: String(updated.riderId) },
            () => this.ridersService.releaseRider(String(updated.riderId)),
          )
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
      // On delivery: trigger referral reward for the customer's first completed order
      dto.status === OrderStatus.DELIVERED
        ? this.referralsService
            .onFirstOrderCompleted(orderIdStr, customerId)
            .catch(() => undefined)
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
      // Rider drives PICKED_UP and DELIVERED. PICKED_UP is reachable from both PREPARING
      // (restaurant didn't mark READY) and READY (restaurant did mark it).
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

  // Rider must physically be near the target location to mark PICKED_UP or DELIVERED.
  // Client-side check exists in the driver PWA (A19) but is bypassable — enforce here
  // on the server too. Admin can override (no proximity check for admin transitions).
  private async assertRiderProximity(
    order: OrderDocument,
    dto: UpdateOrderStatusDto,
    requester: JwtPayload,
  ): Promise<void> {
    if (requester.roles.includes(UserRole.SUPER_ADMIN)) return
    if (dto.status !== OrderStatus.PICKED_UP && dto.status !== OrderStatus.DELIVERED) return
    if (!requester.roles.includes(UserRole.RIDER)) return

    const target =
      dto.status === OrderStatus.PICKED_UP
        ? order.restaurantPickupAddress?.coordinates
        : order.deliveryAddress?.coordinates
    // Missing pickup coords on legacy orders — allow through (no way to verify).
    if (!target?.coordinates || target.coordinates.length !== 2) return

    const rider = await this.ridersService.getProfile(requester.sub)
    const loc = rider.currentLocation
    if (!loc?.coordinates || loc.coordinates.length !== 2 || !loc.updatedAt) {
      throw new BadRequestException('Cannot verify your location. Turn on GPS and try again.')
    }
    // Stale positions can't confirm you're actually here — reject > 2 min old.
    const ageMs = Date.now() - new Date(loc.updatedAt).getTime()
    if (ageMs > 120_000) {
      throw new BadRequestException('Your location is out of date. Move to refresh GPS and try again.')
    }

    const distanceKm = calculateDistance(
      { lng: target.coordinates[0], lat: target.coordinates[1] },
      { lng: loc.coordinates[0],    lat: loc.coordinates[1] },
    )
    if (distanceKm > 0.3) {
      const where = dto.status === OrderStatus.PICKED_UP ? 'the restaurant' : 'the delivery address'
      throw new BadRequestException(`You must be within 300m of ${where} to mark this. You are ${Math.round(distanceKm * 1000)}m away.`)
    }
  }

  // Cash-on-delivery guard — a rider cannot mark a CASH order DELIVERED without
  // explicitly confirming they collected the cash AND uploading a proof photo.
  // Both together are the fraud deterrent — cash+photo means "I got the money and
  // here's evidence I was at the door." Admin can override; if cash was NOT collected
  // the rider must open a dispute via the existing dispute flow.
  private assertCashConfirmationIfNeeded(
    order: OrderDocument,
    dto: UpdateOrderStatusDto,
    requester: JwtPayload,
  ): void {
    if (requester.roles.includes(UserRole.SUPER_ADMIN)) return
    if (dto.status !== OrderStatus.DELIVERED) return
    if (order.payment.method !== PaymentMethod.CASH) return
    if (dto.cashCollected !== true) {
      throw new BadRequestException(
        'Confirm cash was collected from the customer. If not, open a dispute instead.',
      )
    }
    if (!dto.deliveryProofUrl) {
      throw new BadRequestException(
        'A delivery proof photo is required for cash-on-delivery orders.',
      )
    }
  }

  // ── Admin ────────────────────────────────────────────────────────

  async getAdminOrders(
    query: QueryOrdersDto,
  ): Promise<{ data: unknown[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    // Base filter — applied BEFORE $lookup for query efficiency; join collections
    // are only searched over rows that already passed status / payment filters.
    const baseMatch: Record<string, unknown> = { systemClearedAt: null }
    if (query.status)                            baseMatch.status           = query.status
    if (query.paymentStatus)                     baseMatch['payment.status'] = query.paymentStatus

    // Post-join search filter. Regex-escape the user input so a stray `.` or `*`
    // doesn't blow up query cost or accidentally match everything.
    const escapedSearch = query.search?.trim()
      ? query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [
      { $match: baseMatch },
      // Enrich with customer, restaurant, rider (rider is a User doc, not Rider).
      { $lookup: { from: 'users',       localField: 'customerId',   foreignField: '_id', as: 'customer'   } },
      { $lookup: { from: 'restaurants', localField: 'restaurantId', foreignField: '_id', as: 'restaurant' } },
      { $lookup: { from: 'users',       localField: 'riderId',      foreignField: '_id', as: 'rider'      } },
      { $unwind: { path: '$customer',   preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$rider',      preserveNullAndEmptyArrays: true } },
    ]

    if (escapedSearch) {
      pipeline.push({
        $match: {
          $or: [
            { orderNumber:            { $regex: escapedSearch, $options: 'i' } },
            { 'customer.phone':       { $regex: escapedSearch, $options: 'i' } },
            { 'customer.firstName':   { $regex: escapedSearch, $options: 'i' } },
            { 'customer.lastName':    { $regex: escapedSearch, $options: 'i' } },
            { 'restaurant.name':      { $regex: escapedSearch, $options: 'i' } },
          ],
        },
      })
    }

    // Trim populated docs to just what the admin list card needs. Keeps payload
    // small when the customer/restaurant/rider have big embedded arrays.
    pipeline.push({
      $project: {
        orderNumber: 1, status: 1, createdAt: 1, updatedAt: 1,
        items: 1, pricing: 1, payment: 1,
        deliveryAddress: 1, restaurantPickupAddress: 1,
        restaurantAckedAt: 1, dispatchedWithoutRestaurantAck: 1,
        riderAssignedAt: 1, pickedUpAt: 1, actualDeliveryAt: 1,
        cancelReason: 1, cancelledBy: 1,
        // Data-minimization: list rows don't render email — keep the payload
        // small AND avoid needlessly shipping PII across the wire. Detail
        // projection below DOES include email since the participant card renders it.
        customer:   { _id: 1, firstName: 1, lastName: 1, phone: 1 },
        restaurant: { _id: 1, name: 1, ownerId: 1 },
        rider:      { _id: 1, firstName: 1, lastName: 1, phone: 1 },
      },
    })

    // $facet — one round-trip gets both the page and the total.
    pipeline.push({
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ],
        totalArr: [{ $count: 'value' }],
      },
    })

    const [result] = await this.orderModel.aggregate(pipeline)
    const data     = (result?.data ?? []) as unknown[]
    const total    = (result?.totalArr?.[0]?.value ?? 0) as number

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  async getOrderById(orderId: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')
    const order = await this.orderModel.findById(orderId).lean()
    if (!order) throw new NotFoundException('Order not found')
    return order as unknown as OrderDocument
  }

  // Enriched projection for the admin detail page. Same shape as the list
  // rows produced by getAdminOrders — customer/restaurant/rider joined,
  // populated fields trimmed. Saves the admin console from three follow-up
  // fetches per detail view.
  async getAdminOrderById(orderId: string): Promise<unknown> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [
      { $match: { _id: new Types.ObjectId(orderId), systemClearedAt: null } },
      { $lookup: { from: 'users',       localField: 'customerId',   foreignField: '_id', as: 'customer'   } },
      { $lookup: { from: 'restaurants', localField: 'restaurantId', foreignField: '_id', as: 'restaurant' } },
      { $lookup: { from: 'users',       localField: 'riderId',      foreignField: '_id', as: 'rider'      } },
      { $unwind: { path: '$customer',   preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$rider',      preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderNumber: 1, status: 1, createdAt: 1, updatedAt: 1,
          items: 1, pricing: 1, payment: 1,
          deliveryAddress: 1, restaurantPickupAddress: 1,
          deliveryInstructions: 1, customerNote: 1,
          restaurantAckedAt: 1, restaurantConfirmedAt: 1, restaurantReadyAt: 1,
          firstDispatchAt: 1, riderAssignedAt: 1, pickedUpAt: 1, actualDeliveryAt: 1,
          dispatchedWithoutRestaurantAck: 1, dispatchRounds: 1, dispatchBroadcastCount: 1,
          cancelReason: 1, cancelledBy: 1, scheduledFor: 1,
          currency: 1, country: 1, estimatedTime: 1, isFarDelivery: 1, deliveryDistanceKm: 1,
          coupon: 1, ratedAt: 1,
          customer:   { _id: 1, firstName: 1, lastName: 1, phone: 1, email: 1 },
          restaurant: { _id: 1, name: 1, ownerId: 1, address: 1 },
          rider:      { _id: 1, firstName: 1, lastName: 1, phone: 1 },
        },
      },
    ]
    const [order] = await this.orderModel.aggregate(pipeline)
    if (!order) throw new NotFoundException('Order not found')
    return order
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

  async markPaymentComplete(orderId: string, reference: string): Promise<OrderDocument | null> {
    // First, peek at the pending order so we can validate the restaurant BEFORE flipping
    // status. If the restaurant has been terminated or deactivated between checkout and
    // this webhook, we must not dispatch to them — they can't fulfill the order.
    const pending = await this.orderModel.findOne({ _id: orderId, status: OrderStatus.PENDING })
    if (!pending) {
      // Not PENDING → either already CONFIRMED (duplicate webhook), or cancelled.
      // But: if it's CONFIRMED with no rider AND no dispatch rounds recorded, the
      // original dispatch was lost (e.g., Redis crashed after enqueue). Recover by
      // re-enqueuing via SideEffects — customer money is already taken, we owe them
      // a delivery attempt.
      const existing = await this.orderModel.findById(orderId)
      if (existing
          && existing.status === OrderStatus.CONFIRMED
          && !existing.riderId
          && (existing.dispatchRounds ?? 0) === 0) {
        // S-URGENT (Nigerian ack flow): recovery path also schedules the 90s
        // escalation — same reasoning as the happy path. If the restaurant
        // has already acked in the meantime, fire dispatch now instead.
        this.logger.warn(`markPaymentComplete: order ${orderId} is CONFIRMED with no rider and no dispatch rounds — recovering lost dispatch`)
        const lng = existing.deliveryAddress.coordinates.coordinates[0]
        const lat = existing.deliveryAddress.coordinates.coordinates[1]
        if (existing.restaurantAckedAt) {
          await this.fireDispatchNow(orderId, lat, lng)
        } else if (!existing.scheduledFor) {
          // Scheduled orders defer escalation to releaseScheduledOrder — don't
          // pre-schedule it here or the timer fires hours before pickup.
          await this.scheduleDispatchEscalation(orderId, lat, lng)
        }
        return existing
      }
      this.logger.warn(`markPaymentComplete: order ${orderId} is not PENDING — ignoring late webhook (ref=${reference})`)
      return null
    }

    const restaurant = await this.restaurantsService.findByIdRaw(pending.restaurantId.toString())
    const restaurantUnavailable =
      !restaurant ||
      restaurant.terminatedAt !== null ||
      restaurant.isActive === false
    if (restaurantUnavailable) {
      // Record the payment landed, then cancel the order and refund the customer.
      // We flag the order CANCELLED with a specific reason so the timeout metric doesn't
      // miscount this, and the wallet portion (if any) is returned via the standard cancel
      // path. The card portion is refunded via Paystack fire-and-forget with error surfacing.
      const cancelled = await this.orderModel.findOneAndUpdate(
        { _id: orderId, status: OrderStatus.PENDING },
        {
          $set: {
            status: OrderStatus.CANCELLED,
            cancelReason: 'Restaurant unavailable — refunded automatically',
            'payment.status': PaymentStatus.COMPLETED,
            'payment.reference': reference,
            'payment.paidAt': new Date(),
          },
        },
        { new: true },
      )
      if (!cancelled) return null

      this.logger.error(
        `markPaymentComplete: restaurant ${pending.restaurantId} unavailable ` +
        `(terminated=${!!restaurant?.terminatedAt}, active=${restaurant?.isActive}). ` +
        `Order ${orderId} cancelled, initiating refund.`,
      )

      // Wallet portion (if any) — return via wallet ledger
      if ((cancelled.pricing.walletApplied ?? 0) > 0) {
        this.walletService.credit({
          userId:        cancelled.customerId.toString(),
          amount:        cancelled.pricing.walletApplied,
          reason:        WalletTxnReason.REFUND,
          description:   'Wallet returned — restaurant unavailable',
          referenceType: 'order',
          referenceId:   orderId,
        }).catch((err: unknown) => this.logger.error(
          `CRITICAL: wallet refund failed for auto-cancelled order ${orderId}`, err,
        ))
      }
      // Card portion — Paystack refund
      this.paymentsService.initiateRefund(orderId, 'Restaurant unavailable')
        .catch((err: unknown) => this.logger.error(
          `Paystack refund initiation failed for auto-cancelled order ${orderId}`, err,
        ))

      // Notify customer their order was cancelled + refunded
      void this.notificationsService.onOrderStatusChanged(
        cancelled.customerId.toString(),
        cancelled.orderNumber,
        orderId,
        OrderStatus.CANCELLED,
      ).catch(() => undefined)

      return cancelled
    }

    const order = await this.orderModel.findOneAndUpdate(
      { _id: orderId, status: OrderStatus.PENDING },
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
    if (!order) {
      // Order status changed between our peek and this update (e.g., customer cancel raced).
      this.logger.warn(`markPaymentComplete: order ${orderId} changed status during confirm — ignoring`)
      return null
    }

    // Payment confirmed — NOW notify the restaurant and schedule the 90s
    // dispatch escalation. S-URGENT (Nigerian ack flow): dispatch no longer
    // fires immediately on payment. It fires when the restaurant taps Accept
    // OR at T+90s if they never engage. Prevents riders from picking up food
    // the kitchen doesn't know about.
    const ownerId = restaurant.ownerId.toString()

    // Scheduled orders defer both restaurant notification and escalation to
    // releaseScheduledOrder — the restaurant shouldn't see the order in their
    // live queue hours before scheduledFor, and the 90s escalation would fire
    // just as pointlessly early.
    if (order.scheduledFor) return order

    // Notify restaurant (best-effort — socket delivery, has fallback in the app)
    void Promise.resolve(this.trackingService.notifyNewOrder(ownerId, order)).catch(() => undefined)

    // Schedule the 90s fallback dispatch. If the restaurant taps Accept before
    // it fires, cancelDispatchEscalation() in updateStatus removes this job.
    const lng = order.deliveryAddress.coordinates.coordinates[0]
    const lat = order.deliveryAddress.coordinates.coordinates[1]
    await this.scheduleDispatchEscalation(orderId, lat, lng)

    return order
  }

  async markPaymentFailed(orderId: string): Promise<void> {
    await this.orderModel.findByIdAndUpdate(orderId, {
      $set: { 'payment.status': PaymentStatus.FAILED },
    })
  }

  // ── Customer contact for tap-to-call (rider only) ────────────────

  async getCustomerContactForOrder(
    orderId: string,
    riderUserId: string,
  ): Promise<{ customerId: string; firstName: string; lastName: string; phone: string | null }> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found')

    const order = await this.orderModel
      .findById(orderId, { customerId: 1, riderId: 1, status: 1 })
      .populate<{ customerId: { _id: Types.ObjectId; firstName: string; lastName: string; phone: string | null } }>(
        'customerId',
        'firstName lastName phone',
      )
      .lean()

    if (!order) throw new NotFoundException('Order not found')

    // Only the assigned rider may fetch the customer's contact
    if (!order.riderId || order.riderId.toString() !== riderUserId) {
      throw new ForbiddenException('You are not the assigned rider for this order')
    }

    const customer = order.customerId as { _id: Types.ObjectId; firstName: string; lastName: string; phone: string | null }

    // Withhold phone number until the rider has physically picked up the order —
    // before that they are still at the restaurant and don't need to call the customer.
    const phoneRevealed = order.status === OrderStatus.PICKED_UP || order.status === OrderStatus.DELIVERED

    return {
      customerId: customer._id.toString(),
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: phoneRevealed ? (customer.phone ?? null) : null,
    }
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

    // Withhold phone number until the rider has picked up the order — admins always see it.
    const phoneRevealed = isAdmin
      || order.status === OrderStatus.PICKED_UP
      || order.status === OrderStatus.DELIVERED

    return {
      riderId: order.riderId.toString(),
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      phone: phoneRevealed ? (userInfo.phone ?? null) : null,
      vehicleType: (profile['vehicleType'] as string) ?? null,
      vehiclePlate: (profile['vehiclePlate'] as string | null) ?? null,
    }
  }

  // ── Used by RidersService ─────────────────────────────────────────

  async assignRider(orderId: string, riderId: string, riderUserId: string): Promise<OrderDocument> {
    // Atomic: only assign if no rider yet — prevents two riders accepting the same broadcast job.
    // Also stamps riderAssignedAt in the same write so wait-time metrics can never see a row
    // with riderId set but timestamp null (would silently drop it from the aggregation).
    const order = await this.orderModel.findOneAndUpdate(
      { _id: new Types.ObjectId(orderId), riderId: null },
      { $set: { riderId: new Types.ObjectId(riderId), riderAssignedAt: new Date() } },
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

    // S-URGENT (Nigerian ack flow): only auto-advance to PREPARING when the
    // restaurant has actually engaged with the order. Otherwise stay at
    // CONFIRMED — the customer tracker will show "Rider on the way to
    // restaurant" instead of the misleading "Restaurant is preparing your
    // order" (which claims the kitchen is cooking when it hasn't been told
    // yet). When the restaurant later engages via updateStatus, that call
    // stamps restaurantAckedAt and moves the order forward naturally.
    // The atomic filter still guards against double-fire on concurrent calls.
    const preparing = order.restaurantAckedAt
      ? await this.orderModel.findOneAndUpdate(
          { _id: order._id, status: OrderStatus.CONFIRMED },
          { $set: { status: OrderStatus.PREPARING } },
          { new: true },
        )
      : null
    const liveOrder = preparing ?? order

    // riderAssignedAt already stamped atomically in the findOneAndUpdate above.

    void Promise.all([
      this.notificationsService.onRiderAssigned(riderUserId, liveOrder.orderNumber, orderIdStr),
      // Push + SMS to restaurant: "Rider X is on the way, have it ready"
      // This fires even if no one has the admin dashboard open.
      this.notificationsService.onRiderComingToPickup(ownerId, riderUserId, liveOrder.orderNumber, orderIdStr),
      // Notify customer of the PREPARING status so their tracking screen updates
      preparing
        ? this.notificationsService.onOrderStatusChanged(customerId, liveOrder.orderNumber, orderIdStr, OrderStatus.PREPARING)
        : Promise.resolve(),
      this.trackingService.notifyRiderNewJob(riderUserId, liveOrder),
      this.trackingService.notifyOrderStatusUpdate(orderIdStr, customerId, ownerId, liveOrder.status, liveOrder.estimatedTime ?? undefined),
      this.trackingService.notifyRiderAssigned(ownerId, customerId, {
        orderId: orderIdStr,
        riderId,
        riderUserId,
      }),
    ]).catch(() => undefined)

    return liveOrder
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
        }, { jobId: `dispatch-${String(o._id)}` }),
      ),
    )
  }

  async dispatchDebug(orderId: string) {
    const order = await this.getOrderById(orderId)
    const lng = order.deliveryAddress.coordinates.coordinates[0]
    const lat = order.deliveryAddress.coordinates.coordinates[1]

    const nearestAvailable = await this.ridersService.findNearestAvailable(lng, lat)
    const nearbyOnlineVerified = await this.ridersService.findNearbyOnlineVerified(lng, lat)
    const allOnlineVerified = await this.ridersService.findAllOnlineVerified()

    return {
      order: { id: orderId, status: order.status, riderId: order.riderId ?? null, declinedBy: order.declinedBy },
      deliveryCoords: { lng, lat },
      nearestAvailable: nearestAvailable.map((r) => ({ id: r._id, userId: r.userId, isOnline: r.isOnline, isAvailable: r.isAvailable, hasLocation: !!r.currentLocation })),
      nearbyOnlineVerified: nearbyOnlineVerified.map((r) => ({ id: r._id, userId: r.userId, hasLocation: !!r.currentLocation })),
      allOnlineVerified: allOnlineVerified.map((r) => ({ id: r._id, userId: r.userId, isOnline: r.isOnline, isVerified: r.isVerified, hasLocation: !!r.currentLocation })),
      summary: {
        wouldDispatchTo: (nearbyOnlineVerified.length > 0 ? nearbyOnlineVerified : allOnlineVerified).length,
        usingFallback: nearbyOnlineVerified.length === 0,
      },
    }
  }

  // Called by the dispatch processor on each broadcast round to track timing/volume.
  async recordDispatchRound(orderId: string, broadcastCount: number, isFirstRound: boolean): Promise<void> {
    const update: Record<string, unknown> = {
      $inc: { dispatchRounds: 1, dispatchBroadcastCount: broadcastCount },
    }
    if (isFirstRound) {
      update['$set'] = { firstDispatchAt: new Date() }
    }
    await this.orderModel.updateOne({ _id: new Types.ObjectId(orderId) }, update)
  }

  // Called by the dispatch processor at the start of each retry round so riders
  // from the previous round get a fresh shot. Without this, declinedBy accumulates
  // across all rounds and eventually empties the pool before max attempts are reached.
  async clearDeclinedBy(orderId: string): Promise<void> {
    await this.orderModel.updateOne(
      { _id: new Types.ObjectId(orderId) },
      { $set: { declinedBy: [] } },
    )
  }

  // Admin manually re-queues dispatch for a stuck order.
  // Clears declinedBy so all riders get a fresh shot.
  async adminRedispatch(orderId: string): Promise<void> {
    const order = await this.getOrderById(orderId)
    const canDispatch = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(
      order.status as OrderStatus,
    )
    if (!canDispatch) throw new BadRequestException(`Order is ${order.status} — only CONFIRMED/PREPARING/READY orders can be redispatched`)
    if (order.riderId) throw new BadRequestException('Order already has a rider assigned')

    // Refuse to redispatch if the restaurant is no longer serviceable.
    // Admin should cancel + refund the order instead.
    const restaurantOk = await this.restaurantsService.isServiceable(order.restaurantId.toString())
    if (!restaurantOk) {
      throw new BadRequestException('Restaurant is terminated or deactivated — cancel and refund the order instead of redispatching.')
    }

    await this.orderModel.updateOne(
      { _id: new Types.ObjectId(orderId) },
      { $set: { declinedBy: [] } },
    )

    await this.riderDispatchQueue.add('dispatch', {
      orderId,
      lng: order.deliveryAddress.coordinates.coordinates[0],
      lat: order.deliveryAddress.coordinates.coordinates[1],
    }, { jobId: `dispatch-${orderId}` })
  }

  // ── Sprint 13 (S13-4): manual rider reassignment (super-admin) ────
  //
  // Yanks an in-flight order from its current rider (if any) and pins it to a
  // specific new rider. Meant for live-ops intervention — the original rider
  // went dark, refused pickup, is stuck in traffic, etc. Auto-dispatch would
  // normally handle a stalled order via redispatch, but that broadcasts to N
  // riders and takes rounds; reassign is the "I know who I want, do it now" tool.
  //
  // Concurrency: uses the same atomic isAvailable claim as riders.service.assignOrder
  // so two concurrent admin reassigns cannot both grab the same rider.
  async adminReassignRider(orderId: string, newRiderId: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId) || !Types.ObjectId.isValid(newRiderId)) {
      throw new BadRequestException('Invalid orderId or riderId')
    }

    const order = await this.orderModel.findById(orderId)
    if (!order) throw new NotFoundException('Order not found')

    // Reassign only makes sense for active-in-fulfilment orders. Delivered /
    // cancelled orders have nowhere to send a new rider; PENDING orders have
    // no rider-relevant state yet (redispatch is the right tool there).
    const activeStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.PICKED_UP,
    ]
    if (!activeStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(`Cannot reassign — order is ${order.status}`)
    }

    const oldRiderId = order.riderId?.toString() ?? null
    if (oldRiderId === newRiderId) {
      throw new BadRequestException('This rider is already assigned to the order')
    }

    // Delegate the "claim + notify" to the existing rider-service flow so we
    // share the atomic isAvailable check + verified/online guards, then patch
    // the order's rider pointer separately below.
    //
    // We can't reuse assignRider directly because it filters `{ riderId: null }`
    // (won't overwrite an existing rider). So we do the analogous logic here:
    //   1. Atomically claim the new rider (isAvailable = true → false)
    //   2. Overwrite order.riderId, stamp new riderAssignedAt
    //   3. Release the old rider back into the available pool (if any)
    //   4. Notify all parties (new rider, old rider, customer, restaurant)

    const newRider = await this.ridersService.getRiderCore(newRiderId)
    if (!newRider) throw new NotFoundException('New rider not found')
    if (!newRider.isVerified) throw new ForbiddenException('New rider is not verified')
    if (!newRider.isOnline)   throw new BadRequestException('New rider is offline')

    // Atomic claim on the rider row
    const claimed = await this.ridersService.acquireRiderForReassign(newRiderId)
    if (!claimed) throw new BadRequestException('New rider is not available')

    let updated: OrderDocument | null = null
    try {
      updated = await this.orderModel.findOneAndUpdate(
        { _id: new Types.ObjectId(orderId), status: { $in: activeStatuses } },
        { $set: { riderId: new Types.ObjectId(newRiderId), riderAssignedAt: new Date() } },
        { new: true },
      )
      if (!updated) {
        // Order moved to a terminal state between our check and the update.
        // Release the rider we just claimed so they can accept the next offer.
        await this.ridersService.releaseRider(newRiderId).catch(() => undefined)
        throw new ConflictException('Order state changed — reassign aborted')
      }
    } catch (err) {
      await this.ridersService.releaseRider(newRiderId).catch(() => undefined)
      throw err
    }

    // Release the old rider back into the available pool (best-effort — a
    // failure here shouldn't roll back the reassign; the rider can toggle
    // themselves available via the app or admin can force it).
    if (oldRiderId) {
      void this.ridersService.releaseRider(oldRiderId).catch(() => undefined)
    }

    // Notify all parties in parallel. Old rider gets a status_update on the
    // order they were formerly on so their PWA drops back to available-jobs.
    // New rider gets the standard new-job push + socket.
    const orderIdStr = updated._id.toString()
    const customerId = updated.customerId.toString()
    const restaurant = await this.restaurantsService.findByIdRaw(updated.restaurantId.toString())
    const ownerId    = restaurant.ownerId.toString()
    const newRiderUserId = newRider.userId.toString()

    void Promise.all([
      oldRiderId
        ? this.ridersService.getUserIdByRiderId(oldRiderId).then((oldUserId) => {
            if (!oldUserId) return
            // notifyOrderStatusUpdate is fire-and-forget (returns void); the
            // status-changed push is the one the old rider actually sees.
            this.trackingService.notifyOrderStatusUpdate(orderIdStr, customerId, ownerId, updated!.status, updated!.estimatedTime ?? undefined)
            return this.notificationsService.onOrderStatusChanged(oldUserId, updated!.orderNumber, orderIdStr, updated!.status)
          })
        : Promise.resolve(),
      this.notificationsService.onRiderAssigned(newRiderUserId, updated.orderNumber, orderIdStr),
      this.notificationsService.onRiderComingToPickup(ownerId, newRiderUserId, updated.orderNumber, orderIdStr),
      this.trackingService.notifyRiderNewJob(newRiderUserId, updated),
      this.trackingService.notifyOrderStatusUpdate(orderIdStr, customerId, ownerId, updated.status, updated.estimatedTime ?? undefined),
      this.trackingService.notifyRiderAssigned(ownerId, customerId, {
        orderId: orderIdStr,
        riderId: newRiderId,
        riderUserId: newRiderUserId,
      }),
    ]).catch(() => undefined)

    return updated
  }

  // Sprint 13 (S13-4): rider picker for the admin reassign modal. Returns
  // available riders sorted by distance from the ORDER's pickup point, plus
  // a computed distanceKm on each so the admin can eyeball the trade-off.
  // Meant to be called just before opening the reassign modal.
  async getReassignCandidates(orderId: string, limit = 20): Promise<Array<{
    riderId: string
    userId: string
    firstName: string
    lastName: string
    phone: string | null
    vehicleType: string
    vehiclePlate: string | null
    distanceKm: number | null
  }>> {
    const order = await this.getOrderById(orderId)
    const pickup = order.restaurantPickupAddress?.coordinates?.coordinates as [number, number] | undefined
    if (!pickup) throw new BadRequestException('Order has no pickup coordinates')
    const [lng, lat] = pickup

    const raw = await this.ridersService.findAvailableNear(lng, lat, limit) as unknown as Array<{
      _id: Types.ObjectId
      userId: { _id: Types.ObjectId; firstName: string; lastName: string; phone: string | null }
      vehicleType: string
      vehiclePlate: string | null
      currentLocation: { coordinates: [number, number] } | null
    }>

    return raw.map((r) => {
      const rc = r.currentLocation?.coordinates
      const distanceKm = rc
        ? Math.round(calculateDistance({ lat, lng }, { lat: rc[1], lng: rc[0] }) * 10) / 10
        : null
      return {
        riderId:      r._id.toString(),
        userId:       r.userId._id.toString(),
        firstName:    r.userId.firstName,
        lastName:     r.userId.lastName,
        phone:        r.userId.phone,
        vehicleType:  r.vehicleType,
        vehiclePlate: r.vehiclePlate,
        distanceKm,
      }
    })
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
  //
  // S-URGENT: also schedules the 90s dispatch escalation. Without this, scheduled
  // orders would sit at CONFIRMED indefinitely with no dispatch trigger — the
  // create/pay-time escalation was deliberately skipped for scheduled orders
  // (see markPaymentComplete + createOrder paidAtCreate branch).
  async releaseScheduledOrder(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) return
    const order = await this.orderModel.findById(orderId).exec()
    if (!order) return
    // Accept PENDING (card path — awaiting payment) or CONFIRMED (paid-at-create
    // via cash / wallet-full). Both need release-time restaurant notification
    // and escalation scheduling.
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) return
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
      .onOrderStatusChanged(customerId, order.orderNumber, orderId, order.status)
      .catch(() => undefined)
    this.trackingService.notifyOrderStatusUpdate(
      orderId, customerId, ownerId, order.status, order.estimatedTime ?? undefined,
    )

    // Kick the 90s escalation ONLY for orders already CONFIRMED (paid). PENDING
    // scheduled orders still need the customer's payment webhook to land — that
    // path schedules escalation via markPaymentComplete's post-release branch.
    // Guard against double-schedule via BullMQ jobId dedup regardless.
    if (order.status === OrderStatus.CONFIRMED) {
      const lng = order.deliveryAddress.coordinates.coordinates[0]
      const lat = order.deliveryAddress.coordinates.coordinates[1]
      await this.scheduleDispatchEscalation(orderId, lat, lng)
    }
  }

  async cancelIfTimedOut(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) return

    // Atomic: only cancels if still PENDING+PENDING — prevents double-cancel if the timeout
    // job runs twice (e.g. after a worker restart). new:false gives the pre-update doc so
    // we have walletApplied, coupon, and scheduledReleaseJobId without a second read.
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(orderId),
        status: OrderStatus.PENDING,
        'payment.status': PaymentStatus.PENDING,
      },
      {
        $set: {
          status: OrderStatus.CANCELLED,
          cancelReason: 'Payment not completed within 30 minutes',
        },
      },
      { new: false },
    )
    if (!order) return // Already confirmed, paid, or cancelled — nothing to do

    // S-URGENT: kill the 90s escalation timer if one was scheduled — a wallet-full
    // order that hits this timeout path had its escalation queued at create time
    // (via the paidAtCreate branch in createOrder). Without cancel, escalation
    // fires against an already-cancelled order.
    void this.cancelDispatchEscalation(orderId)

    // Remove the scheduled release job so the restaurant never receives a ghost notification
    if (order.scheduledReleaseJobId) {
      this.scheduledOrderQueue
        .getJob(order.scheduledReleaseJobId)
        .then((job) => job?.remove())
        .catch(() => undefined)
    }

    // Wallet portion was already debited but card never arrived — refund it.
    // Wallet credit is CRITICAL: silent failure = customer money vanishes with no linkage.
    // The SideEffects sweeper picks up any failure and retries with backoff.
    if ((order.pricing.walletApplied ?? 0) > 0) {
      const refundPayload = {
        userId:      order.customerId.toString(),
        amount:      order.pricing.walletApplied,
        description: 'Wallet refund — payment timed out',
        referenceId: orderId,
      }
      void this.sideEffects.tryOrEnqueue(
        SideEffectType.WALLET_REFUND,
        `wallet-refund:timeout:${orderId}`,
        refundPayload,
        () => this.walletService.credit({
          userId:        refundPayload.userId,
          amount:        refundPayload.amount,
          reason:        WalletTxnReason.REFUND,
          description:   refundPayload.description,
          referenceType: 'order',
          referenceId:   refundPayload.referenceId,
        }),
      )
    }

    // Release coupon slot — usage record exists by the time the 30-min timeout fires.
    if (order.coupon?.code) {
      this.platformConfigService.revokeCouponUsage(orderId).catch(() => undefined)
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
