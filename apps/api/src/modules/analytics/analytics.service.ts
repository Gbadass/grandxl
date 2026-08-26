import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { Model, Types } from 'mongoose'
import { OrderDocument } from '../orders/schemas/order.schema'
import { RestaurantDocument } from '../restaurants/schemas/restaurant.schema'
import { RiderDocument } from '../riders/schemas/rider.schema'
import { RiderOnlineSessionDocument } from '../riders/schemas/rider-online-session.schema'
import {
  ORDER_TIMEOUT_QUEUE,
  RIDER_DISPATCH_QUEUE,
  SCHEDULED_ORDER_QUEUE,
  SETTLEMENT_QUEUE,
} from '../jobs/constants/queue.constants'

// Cap for open rider sessions (endAt=null). A session that stays open longer than
// this is almost certainly a rider whose browser died without going offline. We
// clamp to this instead of "now" so their utilization doesn't get inflated by
// phantom hours. 12h is generous — real shifts don't run that long.
const STALE_SESSION_MS = 12 * 60 * 60 * 1000

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(
    @InjectModel(OrderDocument.name) private orderModel: Model<OrderDocument>,
    @InjectModel(RestaurantDocument.name) private restaurantModel: Model<RestaurantDocument>,
    @InjectModel(RiderDocument.name) private riderModel: Model<RiderDocument>,
    @InjectModel(RiderOnlineSessionDocument.name) private sessionModel: Model<RiderOnlineSessionDocument>,
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
    // Each queue counted independently — a Redis blip on one queue must not
    // black out the whole dashboard. Failed queues report zeros so ops still
    // sees the healthy queues at a glance.
    const safeCount = async (queue: Queue, name: string) => {
      try {
        return await queue.getJobCounts('waiting', 'active', 'delayed', 'failed')
      } catch (err) {
        this.logger.error(`Failed to read queue depth for "${name}": ${String(err)}`)
        return { waiting: 0, active: 0, delayed: 0, failed: 0 }
      }
    }
    const [orderTimeoutCounts, riderDispatchCounts, scheduledOrderCounts, settlementCounts] =
      await Promise.all([
        safeCount(this.orderTimeoutQueue,   ORDER_TIMEOUT_QUEUE),
        safeCount(this.riderDispatchQueue,  RIDER_DISPATCH_QUEUE),
        safeCount(this.scheduledOrderQueue, SCHEDULED_ORDER_QUEUE),
        safeCount(this.settlementQueue,     SETTLEMENT_QUEUE),
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

  // ── Sprint 4.5 metrics ────────────────────────────────────────────

  // Orders that got cancelled without ever making it out of PENDING/CONFIRMED
  // are timeouts — either the customer never paid or the restaurant ignored the
  // modal and no rider grabbed it in time.
  async getOrderTimeoutMetrics(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [total, timeouts] = await Promise.all([
      this.orderModel.countDocuments({ createdAt: { $gte: since } }),
      this.orderModel.aggregate([
        // Timeout reasons must match EXACTLY what the code writes. Update this list
        // if you add a new timeout path. Verified sources:
        //   - orders.service.ts:1476  → 'Payment not completed within 30 minutes'
        //   - RestaurantOrderModal.tsx:49 → 'Restaurant did not respond in time'
        { $match: {
            createdAt: { $gte: since },
            status: 'cancelled',
            cancelReason: {
              $in: [
                'Restaurant did not respond in time',
                'Payment not completed within 30 minutes',
              ],
            },
        } },
        { $group: { _id: '$cancelReason', count: { $sum: 1 } } },
      ]),
    ])

    const byReason: Record<string, number> = {}
    let totalTimeouts = 0
    for (const row of timeouts as Array<{ _id: string; count: number }>) {
      byReason[row._id] = row.count
      totalTimeouts += row.count
    }

    return {
      periodDays: days,
      totalOrders: total,
      totalTimeouts,
      timeoutRate: total > 0 ? Math.round((totalTimeouts / total) * 1000) / 10 : 0, // one decimal %
      byReason,
    }
  }

  // Engagement = did the restaurant staff actively tap Accept, Ready, OR Reject?
  // Purely passive restaurants (rider drove the whole flow, no clicks) show 0%.
  // Rejections count as engagement — the restaurant actively decided, they just said no.
  async getRestaurantEngagementMetrics(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Base match — include cancelled orders IF the reason indicates restaurant action.
    // Excludes system timeouts (payment + modal ignore) which aren't engagement signals.
    const baseMatch = {
      createdAt: { $gte: since },
      $or: [
        { status: { $in: ['preparing', 'ready', 'picked_up', 'delivered'] } },
        { status: 'cancelled', cancelReason: 'Rejected by restaurant' },
      ],
    }
    // engaged = restaurant clicked Accept, Ready, OR Reject (rejection = active decision)
    const engagedCond = { $sum: { $cond: [
      { $or: [
        { $ne: ['$restaurantConfirmedAt', null] },
        { $ne: ['$restaurantReadyAt', null] },
        { $eq: ['$cancelReason', 'Rejected by restaurant'] },
      ] }, 1, 0,
    ] } }

    const [overall, byRestaurant] = await Promise.all([
      this.orderModel.aggregate([
        { $match: baseMatch },
        { $group: {
            _id: null,
            total:        { $sum: 1 },
            engaged:      engagedCond,
            acceptedOnly: { $sum: { $cond: [{ $ne: ['$restaurantConfirmedAt', null] }, 1, 0] } },
            readyOnly:    { $sum: { $cond: [{ $ne: ['$restaurantReadyAt', null] }, 1, 0] } },
            rejectedOnly: { $sum: { $cond: [{ $eq: ['$cancelReason', 'Rejected by restaurant'] }, 1, 0] } },
        } },
      ]),
      this.orderModel.aggregate([
        { $match: baseMatch },
        { $group: {
            _id: '$restaurantId',
            total:   { $sum: 1 },
            engaged: engagedCond,
        } },
        // Only surface restaurants with meaningful volume — 1 order = noise
        { $match: { total: { $gte: 5 } } },
        { $addFields: {
            engagementRate: { $round: [{ $multiply: [{ $divide: ['$engaged', '$total'] }, 100] }, 1] },
        } },
        { $lookup: {
            from: 'restaurants', localField: '_id', foreignField: '_id', as: 'r',
        } },
        { $unwind: { path: '$r', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, restaurantId: '$_id', name: '$r.name', total: 1, engaged: 1, engagementRate: 1 } },
        { $sort: { engagementRate: 1 } }, // worst first — those are the ones to coach
        { $limit: 25 },
      ]),
    ])

    const o = overall[0] ?? { total: 0, engaged: 0, acceptedOnly: 0, readyOnly: 0, rejectedOnly: 0 }
    return {
      periodDays: days,
      totalOrders:     o.total as number,
      engagedOrders:   o.engaged as number,
      engagementRate:  (o.total as number) > 0
        ? Math.round(((o.engaged as number) / (o.total as number)) * 1000) / 10
        : 0,
      acceptedCount:   o.acceptedOnly as number,
      readyCount:      o.readyOnly as number,
      rejectedCount:   o.rejectedOnly as number,
      worstRestaurants: byRestaurant,
    }
  }

  // Dwell time = pickedUpAt − riderAssignedAt. Includes travel to restaurant,
  // but restaurant-to-restaurant variance surfaces the slow ones anyway.
  async getRestaurantWaitTimes(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const results = await this.orderModel.aggregate([
      { $match: {
          createdAt:        { $gte: since },
          riderAssignedAt:  { $ne: null },
          pickedUpAt:       { $ne: null },
      } },
      { $project: {
          restaurantId: 1,
          dwellMs: { $subtract: ['$pickedUpAt', '$riderAssignedAt'] },
      } },
      { $group: {
          _id: '$restaurantId',
          avgDwellMs: { $avg: '$dwellMs' },
          maxDwellMs: { $max: '$dwellMs' },
          count:      { $sum: 1 },
      } },
      { $match: { count: { $gte: 5 } } },
      { $lookup: { from: 'restaurants', localField: '_id', foreignField: '_id', as: 'r' } },
      { $unwind: { path: '$r', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 0,
          restaurantId: '$_id',
          name: '$r.name',
          avgWaitSeconds: { $round: [{ $divide: ['$avgDwellMs', 1000] }, 0] },
          maxWaitSeconds: { $round: [{ $divide: ['$maxDwellMs', 1000] }, 0] },
          orderCount: '$count',
      } },
      { $sort: { avgWaitSeconds: -1 } }, // slowest first
      { $limit: 25 },
    ])

    return { periodDays: days, restaurants: results }
  }

  // Utilization = busy time / online time.
  // Busy time = sum of (actualDeliveryAt − riderAssignedAt) for the rider's orders.
  // Online time = sum of (endAt − startAt) across their sessions, clamped to window.
  async getRiderUtilization(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const now = new Date()

    const [busyRows, onlineRows] = await Promise.all([
      this.orderModel.aggregate([
        { $match: {
            actualDeliveryAt: { $gte: since, $ne: null },
            riderAssignedAt:  { $ne: null },
            riderId:          { $ne: null },
        } },
        { $group: {
            _id: '$riderId',
            busyMs: { $sum: { $subtract: ['$actualDeliveryAt', '$riderAssignedAt'] } },
            deliveries: { $sum: 1 },
        } },
      ]),
      this.sessionModel.aggregate([
        // Session overlaps window if it started before window ended AND it hasn't ended
        // before window started. Clamp start/end to window boundaries before diff.
        { $match: {
            $or: [
              { endAt: null },
              { endAt: { $gte: since } },
            ],
            startAt: { $lte: now },
        } },
        { $project: {
            riderId: 1,
            clampedStart: { $cond: [{ $gt: ['$startAt', since] }, '$startAt', since] },
            // For open sessions (endAt=null), cap the implied end at startAt + STALE_HOURS.
            // A rider whose browser crashed left the session open indefinitely; we can't
            // pretend they're still online. Cap generously so real long shifts still count.
            clampedEnd:   { $ifNull: [
              '$endAt',
              { $min: [
                now,
                { $add: ['$startAt', STALE_SESSION_MS] },
              ] },
            ] },
        } },
        { $group: {
            _id: '$riderId',
            onlineMs: { $sum: { $subtract: ['$clampedEnd', '$clampedStart'] } },
        } },
      ]),
    ])

    const busyByRider   = new Map(busyRows.map((r) => [String(r._id), r as { busyMs: number; deliveries: number }]))
    const onlineByRider = new Map(onlineRows.map((r) => [String(r._id), r as { onlineMs: number }]))

    // Union of rider ids
    const riderIds = new Set<string>([...busyByRider.keys(), ...onlineByRider.keys()])

    let totalBusyMs = 0
    let totalOnlineMs = 0
    const perRider: Array<{
      riderId: string; busySeconds: number; onlineSeconds: number; utilization: number; deliveries: number
    }> = []

    for (const rid of riderIds) {
      const busy   = busyByRider.get(rid)?.busyMs ?? 0
      const online = onlineByRider.get(rid)?.onlineMs ?? 0
      // Cap busy at online — clock skew or missing session data shouldn't produce > 100%
      const effectiveBusy = Math.min(busy, online || busy)
      totalBusyMs   += effectiveBusy
      totalOnlineMs += online
      perRider.push({
        riderId:       rid,
        busySeconds:   Math.round(effectiveBusy / 1000),
        onlineSeconds: Math.round(online / 1000),
        utilization:   online > 0 ? Math.round((effectiveBusy / online) * 1000) / 10 : 0,
        deliveries:    busyByRider.get(rid)?.deliveries ?? 0,
      })
    }

    perRider.sort((a, b) => b.utilization - a.utilization)

    return {
      periodDays: days,
      riderCount: perRider.length,
      avgUtilization: totalOnlineMs > 0
        ? Math.round((totalBusyMs / totalOnlineMs) * 1000) / 10
        : 0,
      totalBusyHours:   Math.round((totalBusyMs / 3_600_000) * 10) / 10,
      totalOnlineHours: Math.round((totalOnlineMs / 3_600_000) * 10) / 10,
      topRiders:    perRider.slice(0, 10),
      bottomRiders: [...perRider].reverse().slice(0, 10),
    }
  }
}
