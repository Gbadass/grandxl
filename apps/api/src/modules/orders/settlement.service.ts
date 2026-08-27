import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { OrderDocument } from './schemas/order.schema'
import { OrderStatus } from '@grandxl/types'
import { RidersService } from '../riders/riders.service'
import { RestaurantsService } from '../restaurants/restaurants.service'

// Rider AND restaurant earnings settlement — runs nightly, promotes pending → total
// for orders delivered more than 24h ago. The 24h hold gives customers a window
// to dispute the order before the counterparty can cash out. Rider and restaurant
// settlement run as separate claim/settle passes so a failure in one doesn't
// affect the other (rider earnings are per-order deliveryFee+tip; restaurant
// earnings are per-order subtotal−discount — different math, same lifecycle).
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name)

  constructor(
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderDocument>,
    @Inject(forwardRef(() => RidersService))
    private readonly ridersService: RidersService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async runSettlement(): Promise<{
    ordersSettled: number; totalMovedKobo: number
    restaurantOrdersSettled: number; restaurantTotalMovedKobo: number
  }> {
    const rider      = await this.settleRiderEarnings()
    const restaurant = await this.settleRestaurantEarnings()
    return {
      ordersSettled:            rider.ordersSettled,
      totalMovedKobo:           rider.totalMovedKobo,
      restaurantOrdersSettled:  restaurant.ordersSettled,
      restaurantTotalMovedKobo: restaurant.totalMovedKobo,
    }
  }

  private async settleRiderEarnings(): Promise<{ ordersSettled: number; totalMovedKobo: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const settledAt = new Date()

    // Pre-stamp orders as settled BEFORE processing. This is the idempotency key:
    // if BullMQ retries the job after processing but before the stamp, the same
    // orders won't be picked up again because the filter already excludes them.
    // The atomic claim ensures concurrent job instances don't double-process.
    const claimed = await this.orderModel.updateMany(
      {
        status:                 OrderStatus.DELIVERED,
        actualDeliveryAt:       { $lte: cutoff },
        riderEarningsSettledAt: null,
        riderId:                { $ne: null },
      },
      { $set: { riderEarningsSettledAt: settledAt } },
    )

    if (claimed.modifiedCount === 0) {
      this.logger.log('Rider settlement: no unsettled orders found')
      return { ordersSettled: 0, totalMovedKobo: 0 }
    }

    // Fetch only the orders we just claimed (by the exact timestamp we stamped)
    const orders = await this.orderModel.find(
      { riderEarningsSettledAt: settledAt, riderId: { $ne: null } },
      { _id: 1, riderId: 1, pricing: 1 },
    ).lean() as unknown as Array<{
      _id:     Types.ObjectId
      riderId: Types.ObjectId
      pricing: { deliveryFee: number; tip?: number }
    }>

    let totalMovedKobo = 0
    const perRider = new Map<string, number>()

    for (const order of orders) {
      const amount = order.pricing.deliveryFee + (order.pricing.tip ?? 0)
      const key    = order.riderId.toString()
      perRider.set(key, (perRider.get(key) ?? 0) + amount)
      totalMovedKobo += amount
    }

    // Move pending → total per rider via the service layer (no raw DB access).
    await Promise.allSettled(
      Array.from(perRider.entries()).map(([riderId, amount]) =>
        this.ridersService.settleEarnings(riderId, amount),
      ),
    )

    this.logger.log(
      `Rider settlement complete: ${orders.length} orders, ₦${(totalMovedKobo / 100).toFixed(2)} across ${perRider.size} riders`,
    )

    return { ordersSettled: orders.length, totalMovedKobo }
  }

  // Sprint 12 (S12-6): restaurant earnings settlement. Mirrors the rider pass —
  // separate claim so a rider settlement failure can't stall restaurant payouts.
  private async settleRestaurantEarnings(): Promise<{ ordersSettled: number; totalMovedKobo: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const settledAt = new Date()

    const claimed = await this.orderModel.updateMany(
      {
        status:                      OrderStatus.DELIVERED,
        actualDeliveryAt:            { $lte: cutoff },
        restaurantEarningsSettledAt: null,
      },
      { $set: { restaurantEarningsSettledAt: settledAt } },
    )

    if (claimed.modifiedCount === 0) {
      this.logger.log('Restaurant settlement: no unsettled orders found')
      return { ordersSettled: 0, totalMovedKobo: 0 }
    }

    const orders = await this.orderModel.find(
      { restaurantEarningsSettledAt: settledAt },
      { _id: 1, restaurantId: 1, pricing: 1 },
    ).lean() as unknown as Array<{
      _id:          Types.ObjectId
      restaurantId: Types.ObjectId
      pricing:      { subtotal: number; discount?: number }
    }>

    let totalMovedKobo = 0
    const perRestaurant = new Map<string, number>()

    for (const order of orders) {
      const amount = Math.max(0, order.pricing.subtotal - (order.pricing.discount ?? 0))
      const key    = order.restaurantId.toString()
      perRestaurant.set(key, (perRestaurant.get(key) ?? 0) + amount)
      totalMovedKobo += amount
    }

    await Promise.allSettled(
      Array.from(perRestaurant.entries()).map(([restaurantId, amount]) =>
        this.restaurantsService.settleEarnings(restaurantId, amount),
      ),
    )

    this.logger.log(
      `Restaurant settlement complete: ${orders.length} orders, ₦${(totalMovedKobo / 100).toFixed(2)} across ${perRestaurant.size} restaurants`,
    )

    return { ordersSettled: orders.length, totalMovedKobo }
  }
}
