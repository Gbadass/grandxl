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
    // Atomic: aggregation pipeline with $merge writes the aggregated result
    // straight to the target document in one MongoDB operation. Removes the
    // read → wait → write TOCTOU window where concurrent reviews were being
    // under-counted (both aggregations would compute against a stale set).
    // Under true concurrency, MongoDB serializes the $merge writes; the query
    // that sees the most-recent inserts wins, which is what we want.
    const restId = new Types.ObjectId(restaurantId)
    await this.reviewModel.aggregate([
      { $match: { restaurantId: restId, isVisible: true } },
      { $group: {
          _id: null,
          avgRating: { $avg: '$restaurantRating' },
          count: { $sum: 1 },
      } },
      { $project: {
          _id: restId,
          rating: { $round: [{ $ifNull: ['$avgRating', 0] }, 1] },
          ratingCount: { $ifNull: ['$count', 0] },
      } },
      { $merge: {
          into: 'restaurants',
          on: '_id',
          whenMatched: 'merge',
          whenNotMatched: 'discard',
      } },
    ])
  }

  private async updateRiderRating(riderId: string): Promise<void> {
    // Atomic — same $merge pattern as updateRestaurantRating.
    // NOTE: `riderId` param here is actually the rider's userId (see call site in
    // createReview: `order.riderId.toString()` where `order.riderId` is a Rider _id).
    // The rider doc is keyed on _id. We need to look up the rider _id equivalent for
    // riderId — but here `riderId` IS the rider._id (from Order.riderId FK). So we
    // $merge on _id directly.
    const rid = new Types.ObjectId(riderId)
    // The `on` field on $merge needs a unique index. rider._id is unique by default.
    await this.reviewModel.aggregate([
      { $match: { riderRating: { $ne: null } } },
      { $lookup: { from: 'orders', localField: 'orderId', foreignField: '_id', as: 'order' } },
      { $unwind: '$order' },
      { $match: { 'order.riderId': rid } },
      { $group: {
          _id: null,
          avgRating: { $avg: '$riderRating' },
          count: { $sum: 1 },
      } },
      { $project: {
          _id: rid,
          rating: { $round: [{ $ifNull: ['$avgRating', 0] }, 1] },
          ratingCount: { $ifNull: ['$count', 0] },
      } },
      { $merge: {
          into: 'riders',
          on: '_id',
          whenMatched: 'merge',
          whenNotMatched: 'discard',
      } },
    ])
  }
}
