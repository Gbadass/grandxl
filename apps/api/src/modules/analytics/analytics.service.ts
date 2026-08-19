import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { OrderDocument } from '../orders/schemas/order.schema'
import { RestaurantDocument } from '../restaurants/schemas/restaurant.schema'
import { RiderDocument } from '../riders/schemas/rider.schema'

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(OrderDocument.name) private orderModel: Model<OrderDocument>,
    @InjectModel(RestaurantDocument.name) private restaurantModel: Model<RestaurantDocument>,
    @InjectModel(RiderDocument.name) private riderModel: Model<RiderDocument>,
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
}
