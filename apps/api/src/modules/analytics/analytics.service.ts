import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { Model, Types } from 'mongoose'
import { OrderDocument } from '../orders/schemas/order.schema'
import { RestaurantDocument } from '../restaurants/schemas/restaurant.schema'
import { RiderDocument } from '../riders/schemas/rider.schema'
import {
  ORDER_TIMEOUT_QUEUE,
  RIDER_DISPATCH_QUEUE,
  SCHEDULED_ORDER_QUEUE,
  SETTLEMENT_QUEUE,
} from '../jobs/constants/queue.constants'

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(OrderDocument.name) private orderModel: Model<OrderDocument>,
    @InjectModel(RestaurantDocument.name) private restaurantModel: Model<RestaurantDocument>,
    @InjectModel(RiderDocument.name) private riderModel: Model<RiderDocument>,
    @InjectQueue(ORDER_TIMEOUT_QUEUE) private orderTimeoutQueue: Queue,
    @InjectQueue(RIDER_DISPATCH_QUEUE) private riderDispatchQueue: Queue,
    @InjectQueue(SCHEDULED_ORDER_QUEUE) private scheduledOrderQueue: Queue,
    @InjectQueue(SETTLEMENT_QUEUE) private settlementQueue: Queue,
  ) {}

  async getPlatformAnalytics() {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalOrders,
      completedOrders,
      cancelledOrders,
      revenueAgg,
      dailyOrders,
      totalRestaurants,
      activeRestaurants,
      totalRiders,
      activeRiders,
      topRestaurants,
    ] = await Promise.all([
      this.orderModel.countDocuments(),
      this.orderModel.countDocuments({ status: 'delivered' }),
      this.orderModel.countDocuments({ status: 'cancelled' }),
      this.orderModel.aggregate([
        { $match: { status: 'delivered' } },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.total' },
            commission: { $sum: '$pricing.serviceFee' },
          },
        },
      ]),
      this.orderModel.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$pricing.total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.restaurantModel.countDocuments(),
      this.restaurantModel.countDocuments({ approvalStatus: 'approved' }),
      this.riderModel.countDocuments(),
      this.riderModel.countDocuments({ isVerified: true, isSuspended: false }),
      this.orderModel.aggregate([
        { $match: { status: 'delivered', createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$restaurantId',
            orderCount: { $sum: 1 },
            revenue: { $sum: '$pricing.total' },
          },
        },
        { $sort: { orderCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'restaurants',
            localField: '_id',
            foreignField: '_id',
            as: 'restaurant',
          },
        },
        { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$restaurant.name', orderCount: 1, revenue: 1 } },
      ]),
    ])

    const rev = revenueAgg[0] ?? { total: 0, commission: 0 }

    return {
      orders: {
        total: totalOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
        completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
      },
      revenue: {
        totalKobo: rev.total as number,
        commissionKobo: rev.commission as number,
      },
      restaurants: { total: totalRestaurants, active: activeRestaurants },
      riders: { total: totalRiders, active: activeRiders },
      dailyOrders,
      topRestaurants,
    }
  }

  async getRestaurantAnalytics(restaurantId: string) {
    const rid = new Types.ObjectId(restaurantId)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [totalOrders, completedOrders, cancelledOrders, revenueAgg, dailyOrders, topItems] =
      await Promise.all([
        this.orderModel.countDocuments({ restaurantId: rid }),
        this.orderModel.countDocuments({ restaurantId: rid, status: 'delivered' }),
        this.orderModel.countDocuments({ restaurantId: rid, status: 'cancelled' }),
        this.orderModel.aggregate([
          { $match: { restaurantId: rid, status: 'delivered' } },
          {
            $group: {
              _id: null,
              total: { $sum: '$pricing.subtotal' },
              orders: { $sum: 1 },
            },
          },
        ]),
        this.orderModel.aggregate([
          { $match: { restaurantId: rid, createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              revenue: { $sum: '$pricing.subtotal' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.orderModel.aggregate([
          { $match: { restaurantId: rid, status: 'delivered' } },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.name',
              count: { $sum: '$items.quantity' },
              revenue: { $sum: '$items.itemTotal' },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { name: '$_id', count: 1, revenue: 1, _id: 0 } },
        ]),
      ])

    const rev = revenueAgg[0] ?? { total: 0, orders: 0 }

    return {
      orders: {
        total: totalOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
        completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
      },
      revenue: {
        totalKobo: rev.total as number,
        avgOrderKobo:
          (rev.orders as number) > 0
            ? Math.round((rev.total as number) / (rev.orders as number))
            : 0,
      },
      dailyOrders,
      topItems,
    }
  }

  // ── Sprint 4: Dispatch observability ──────────────────────────────

  async getDispatchMetrics(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [waitTimeAgg, roundsAgg, forceAssignCount, noRiderCount] = await Promise.all([
      // Median/avg time from firstDispatchAt → riderAssignedAt (only orders where both are set)
      this.orderModel.aggregate([
        {
          $match: {
            firstDispatchAt: { $gte: since, $ne: null },
            riderAssignedAt: { $ne: null },
          },
        },
        {
          $project: {
            waitMs: {
              $subtract: ['$riderAssignedAt', '$firstDispatchAt'],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgWaitMs: { $avg: '$waitMs' },
            minWaitMs: { $min: '$waitMs' },
            maxWaitMs: { $max: '$waitMs' },
            count: { $sum: 1 },
          },
        },
      ]),
      // Average broadcast rounds per dispatched order
      this.orderModel.aggregate([
        {
          $match: {
            firstDispatchAt: { $gte: since, $ne: null },
            dispatchRounds: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            avgRounds: { $avg: '$dispatchRounds' },
            avgBroadcastCount: { $avg: '$dispatchBroadcastCount' },
            totalDispatched: { $sum: 1 },
          },
        },
      ]),
      // Orders assigned on final attempt (rounds === max attempts) = force-assigned
      this.orderModel.countDocuments({
        firstDispatchAt: { $gte: since, $ne: null },
        riderAssignedAt: { $ne: null },
        dispatchRounds: { $gte: 5 },
      }),
      // Orders that got no rider (still in terminal state without riderId)
      this.orderModel.countDocuments({
        firstDispatchAt: { $gte: since, $ne: null },
        riderAssignedAt: null,
        status: { $in: ['cancelled', 'delivered'] },
      }),
    ])

    const wt = waitTimeAgg[0] ?? { avgWaitMs: 0, minWaitMs: 0, maxWaitMs: 0, count: 0 }
    const rd = roundsAgg[0] ?? { avgRounds: 0, avgBroadcastCount: 0, totalDispatched: 0 }

    return {
      periodDays: days,
      assignedOrders: wt.count as number,
      avgWaitSeconds: Math.round((wt.avgWaitMs as number) / 1000),
      minWaitSeconds: Math.round((wt.minWaitMs as number) / 1000),
      maxWaitSeconds: Math.round((wt.maxWaitMs as number) / 1000),
      avgDispatchRounds: Math.round(((rd.avgRounds as number) ?? 0) * 10) / 10,
      avgBroadcastCount: Math.round(((rd.avgBroadcastCount as number) ?? 0) * 10) / 10,
      totalDispatchedOrders: rd.totalDispatched as number,
      forceAssignCount,
      noRiderCount,
    }
  }

  async getQueueDepth() {
    const [orderTimeoutCounts, riderDispatchCounts, scheduledOrderCounts, settlementCounts] =
      await Promise.all([
        this.orderTimeoutQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        this.riderDispatchQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        this.scheduledOrderQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        this.settlementQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      ])

    return {
      queues: {
        [ORDER_TIMEOUT_QUEUE]: orderTimeoutCounts,
        [RIDER_DISPATCH_QUEUE]: riderDispatchCounts,
        [SCHEDULED_ORDER_QUEUE]: scheduledOrderCounts,
        [SETTLEMENT_QUEUE]: settlementCounts,
      },
    }
  }

  async getOrderHeatmap(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const points = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          'deliveryAddress.coordinates': { $ne: null },
        },
      },
      {
        $project: {
          lng: { $arrayElemAt: ['$deliveryAddress.coordinates.coordinates', 0] },
          lat: { $arrayElemAt: ['$deliveryAddress.coordinates.coordinates', 1] },
        },
      },
      // Cluster into ~0.01° grid cells (≈1km resolution) to reduce payload size
      {
        $group: {
          _id: {
            lat: { $round: [{ $toDouble: '$lat' }, 2] },
            lng: { $round: [{ $toDouble: '$lng' }, 2] },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, lat: '$_id.lat', lng: '$_id.lng', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 2000 },
    ])

    return { periodDays: days, points }
  }
}
