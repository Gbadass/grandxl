import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { ReviewDocument } from './schemas/review.schema'
import { OrdersService } from '../orders/orders.service'
import { OrderStatus } from '@grandxl/types'
import type { CreateReviewDto } from './dto/create-review.dto'

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(ReviewDocument.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly ordersService: OrdersService,
  ) {}

  // ── Submit review ────────────────────────────────────────────────

  async createReview(customerId: string, dto: CreateReviewDto): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(dto.orderId)) {
      throw new BadRequestException('Invalid order ID')
    }

    // Verify the order belongs to this customer and was delivered
    const order = await this.ordersService.getCustomerOrderById(dto.orderId, customerId)
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('You can only review delivered orders')
    }

    // One review per order — catch duplicate key error from the unique index
    try {
      const review = await this.reviewModel.create({
        customerId: new Types.ObjectId(customerId),
        restaurantId: order.restaurantId,
        orderId: new Types.ObjectId(dto.orderId),
        restaurantRating: dto.restaurantRating,
        riderRating: dto.riderRating ?? null,
        foodRating: dto.foodRating ?? null,
        comment: dto.comment?.trim() ?? null,
      })

      // Update restaurant's rolling average rating
      await this.updateRestaurantRating(order.restaurantId.toString())

      // Update rider's rolling average rating if provided
      if (dto.riderRating !== undefined && order.riderId) {
        await this.updateRiderRating(order.riderId.toString())
      }

      return review
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        throw new ConflictException('You have already reviewed this order')
      }
      throw err
    }
  }

  // ── Public — restaurant reviews ──────────────────────────────────

  async getRestaurantReviews(
    restaurantId: string,
    page = 1,
    limit = 20,
  ): Promise<{ reviews: ReviewDocument[]; total: number }> {
    if (!Types.ObjectId.isValid(restaurantId)) throw new NotFoundException('Restaurant not found')

    const filter = {
      restaurantId: new Types.ObjectId(restaurantId),
      isVisible: true,
    }
    const skip = (page - 1) * limit

    const [reviews, total] = await Promise.all([
      this.reviewModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.reviewModel.countDocuments(filter),
    ])

    return { reviews: reviews as unknown as ReviewDocument[], total }
  }

  // ── Customer — own reviews ────────────────────────────────────────

  async getMyReviews(
    customerId: string,
    page = 1,
    limit = 20,
  ): Promise<{ reviews: ReviewDocument[]; total: number }> {
    const filter = { customerId: new Types.ObjectId(customerId) }
    const skip = (page - 1) * limit

    const [reviews, total] = await Promise.all([
      this.reviewModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.reviewModel.countDocuments(filter),
    ])

    return { reviews: reviews as unknown as ReviewDocument[], total }
  }

  // ── User — flag a review as inappropriate ────────────────────────

  async flagReview(reviewId: string, reason: string): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(reviewId)) throw new NotFoundException('Review not found')
    const review = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { $set: { isFlagged: true, flagReason: reason.trim() } },
      { new: true },
    )
    if (!review) throw new NotFoundException('Review not found')
    return review
  }

  // ── Admin — moderate ─────────────────────────────────────────────

  async getFlaggedReviews(
    page = 1,
    limit = 20,
  ): Promise<{ reviews: ReviewDocument[]; total: number }> {
    const filter = { isFlagged: true }
    const skip = (page - 1) * limit
    const [reviews, total] = await Promise.all([
      this.reviewModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.reviewModel.countDocuments(filter),
    ])
    return { reviews: reviews as unknown as ReviewDocument[], total }
  }

  async setVisibility(reviewId: string, isVisible: boolean): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(reviewId)) throw new NotFoundException('Review not found')
    const review = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { $set: { isVisible } },
      { new: true },
    )
    if (!review) throw new NotFoundException('Review not found')
    return review
  }

  // ── Rating aggregation helpers ────────────────────────────────────

  private async updateRestaurantRating(restaurantId: string): Promise<void> {
    const result = await this.reviewModel.aggregate<{ avgRating: number; count: number }>([
      {
        $match: {
          restaurantId: new Types.ObjectId(restaurantId),
          isVisible: true,
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$restaurantRating' },
          count: { $sum: 1 },
        },
      },
    ])

    if (result.length === 0) return

    const { avgRating, count } = result[0]

    // Update restaurant document directly — avoids circular module dependency
    // RestaurantsService is not injected; we use the model indirectly via a raw update
    // The RestaurantDocument model is registered in RestaurantsModule, not here.
    // This update is done via a separate MongooseModel injected in the module.
    await this.reviewModel.db
      .collection('restaurants')
      .updateOne(
        { _id: new Types.ObjectId(restaurantId) },
        { $set: { rating: Math.round(avgRating * 10) / 10, ratingCount: count } },
      )
  }

  private async updateRiderRating(riderId: string): Promise<void> {
    const result = await this.reviewModel.aggregate<{ avgRating: number; count: number }>([
      {
        $match: {
          'riderRating': { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      { $match: { 'order.riderId': new Types.ObjectId(riderId) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$riderRating' },
          count: { $sum: 1 },
        },
      },
    ])

    if (result.length === 0) return

    const { avgRating, count } = result[0]

    await this.reviewModel.db
      .collection('riders')
      .updateOne(
        { userId: new Types.ObjectId(riderId) },
        { $set: { rating: Math.round(avgRating * 10) / 10, ratingCount: count } },
      )
  }
}
