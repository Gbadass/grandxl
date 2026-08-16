import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { OrderDocument } from './schemas/order.schema'
import { OrderStatus } from '@grandxl/types'

// Rider earnings settlement — runs nightly, promotes pending → total for
// orders delivered more than 24h ago. The 24h hold gives customers a window
// to dispute the order before the rider can cash out.
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name)

  constructor(
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async runSettlement(): Promise<{ ordersSettled: number; totalMovedKobo: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Grab unsettled delivered orders older than the cutoff. Cursor keeps
    // memory bounded even after thousands of orders.
    const cursor = this.orderModel.find({
      status:                 OrderStatus.DELIVERED,
      actualDeliveryAt:       { $lte: cutoff },
      riderEarningsSettledAt: null,
      riderId:                { $ne: null },
    }, {
      _id: 1, riderId: 1, pricing: 1,
    }).cursor()

    let ordersSettled = 0
    let totalMovedKobo = 0

    // riderId → aggregate amount to move
    const perRider = new Map<string, number>()
    const orderIds: Types.ObjectId[] = []

    for await (const order of cursor as AsyncIterable<{
      _id:     Types.ObjectId
      riderId: Types.ObjectId
      pricing: { deliveryFee: number; tip?: number }
    }>) {
      const amount = order.pricing.deliveryFee + (order.pricing.tip ?? 0)
      const key    = order.riderId.toString()
      perRider.set(key, (perRider.get(key) ?? 0) + amount)
      orderIds.push(order._id)
      totalMovedKobo += amount
      ordersSettled++
    }

    if (ordersSettled === 0) {
      this.logger.log('Settlement: no unsettled orders found')
      return { ordersSettled: 0, totalMovedKobo: 0 }
    }

    // Move pending → total per rider atomically. $inc handles concurrent writes.
    const riderCollection = this.orderModel.db.db!.collection('riders')
    for (const [riderId, amount] of perRider.entries()) {
      await riderCollection.updateOne(
        { _id: new Types.ObjectId(riderId) },
        {
          $inc: {
            'earnings.totalKobo':   amount,
            'earnings.pendingKobo': -amount,
          },
        },
      )
    }

    // Stamp all settled orders so the next run skips them.
    await this.orderModel.updateMany(
      { _id: { $in: orderIds } },
      { $set: { riderEarningsSettledAt: new Date() } },
    )

    this.logger.log(
      `Settlement complete: ${ordersSettled} orders, ₦${(totalMovedKobo / 100).toFixed(2)} across ${perRider.size} riders`,
    )

    return { ordersSettled, totalMovedKobo }
  }
}
