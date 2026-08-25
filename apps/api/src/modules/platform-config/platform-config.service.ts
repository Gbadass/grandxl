import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { PlatformConfigDocument } from './schemas/platform-config.schema'
import { CouponDocument } from './schemas/coupon.schema'
import { CouponUsageDocument } from './schemas/coupon-usage.schema'
import { CouponUserSlotDocument } from './schemas/coupon-user-slot.schema'
import type { UpdatePlatformConfigDto } from './dto/update-platform-config.dto'
import type { CreateCouponDto } from './dto/create-coupon.dto'

@Injectable()
export class PlatformConfigService implements OnModuleInit {
  constructor(
    @InjectModel(PlatformConfigDocument.name)
    private readonly configModel: Model<PlatformConfigDocument>,
    @InjectModel(CouponDocument.name)
    private readonly couponModel: Model<CouponDocument>,
    @InjectModel(CouponUsageDocument.name)
    private readonly couponUsageModel: Model<CouponUsageDocument>,
    @InjectModel(CouponUserSlotDocument.name)
    private readonly couponUserSlotModel: Model<CouponUserSlotDocument>,
  ) {}

  // Ensure the singleton document exists at startup
  async onModuleInit(): Promise<void> {
    const exists = await this.configModel.findOne()
    if (!exists) {
      await this.configModel.create({})
    }
  }

  // ── Platform config ──────────────────────────────────────────────

  async getConfig(): Promise<PlatformConfigDocument> {
    const config = await this.configModel.findOne()
    if (!config) throw new NotFoundException('Platform config not initialised')
    return config
  }

  async updateConfig(dto: UpdatePlatformConfigDto): Promise<PlatformConfigDocument> {
    const updates: Record<string, unknown> = {}
    if (dto.deliveryTiers !== undefined) updates.deliveryTiers = dto.deliveryTiers
    if (dto.platformCommissionPercent !== undefined) updates.platformCommissionPercent = dto.platformCommissionPercent
    if (dto.serviceFeePercent !== undefined) updates.serviceFeePercent = dto.serviceFeePercent
    if (dto.serviceFeeCapKobo !== undefined) updates.serviceFeeCapKobo = dto.serviceFeeCapKobo
    if (dto.minRiderEarningKobo !== undefined) updates.minRiderEarningKobo = dto.minRiderEarningKobo
    if (dto.enabledServices !== undefined) updates.enabledServices = dto.enabledServices

    const updated = await this.configModel.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true },
    )
    if (!updated) throw new NotFoundException('Platform config not initialised')
    return updated
  }

  // ── Coupons ──────────────────────────────────────────────────────

  async createCoupon(adminId: string, dto: CreateCouponDto): Promise<CouponDocument> {
    const code = dto.code.toUpperCase().trim()

    const existing = await this.couponModel.findOne({ code })
    if (existing) throw new BadRequestException(`Coupon code "${code}" already exists`)

    return this.couponModel.create({
      code,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? 0,
      maxDiscount: dto.maxDiscount ?? 0,
      usageLimit: dto.usageLimit ?? 0,
      perUserLimit: dto.perUserLimit ?? 1,
      applicableRestaurants: (dto.applicableRestaurants ?? []).map(
        (id) => new Types.ObjectId(id),
      ),
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      isActive: true,
      createdBy: new Types.ObjectId(adminId),
    })
  }

  async listCoupons(page = 1, limit = 20): Promise<{ coupons: CouponDocument[]; total: number }> {
    const skip = (page - 1) * limit
    const [coupons, total] = await Promise.all([
      this.couponModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.couponModel.countDocuments(),
    ])
    return { coupons: coupons as unknown as CouponDocument[], total }
  }

  async deactivateCoupon(couponId: string): Promise<CouponDocument> {
    if (!Types.ObjectId.isValid(couponId)) throw new NotFoundException('Coupon not found')
    const coupon = await this.couponModel.findByIdAndUpdate(
      couponId,
      { $set: { isActive: false } },
      { new: true },
    )
    if (!coupon) throw new NotFoundException('Coupon not found')
    return coupon
  }

  // ── Restaurant-owned coupons ─────────────────────────────────────
  // Same underlying schema as admin coupons — the only difference is
  // `applicableRestaurants` is locked to the owner's restaurant, and the
  // owner can only see/manage coupons they created for that restaurant.

  async createRestaurantCoupon(
    ownerId: string,
    restaurantId: string,
    dto: CreateCouponDto,
  ): Promise<CouponDocument> {
    const code = dto.code.toUpperCase().trim()
    const existing = await this.couponModel.findOne({ code })
    if (existing) throw new BadRequestException(`Coupon code "${code}" already exists`)

    return this.couponModel.create({
      code,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? 0,
      maxDiscount:    dto.maxDiscount    ?? 0,
      usageLimit:     dto.usageLimit     ?? 0,
      perUserLimit:   dto.perUserLimit   ?? 1,
      // Force-scope to this restaurant — ignore any `applicableRestaurants` in the dto.
      applicableRestaurants: [new Types.ObjectId(restaurantId)],
      startDate: new Date(dto.startDate),
      endDate:   new Date(dto.endDate),
      isActive:  true,
      createdBy: new Types.ObjectId(ownerId),
    })
  }

  async listRestaurantCoupons(restaurantId: string): Promise<CouponDocument[]> {
    const items = await this.couponModel
      .find({ applicableRestaurants: new Types.ObjectId(restaurantId) })
      .sort({ createdAt: -1 })
      .lean()
    return items as unknown as CouponDocument[]
  }

  async deactivateRestaurantCoupon(
    ownerId: string,
    restaurantId: string,
    couponId: string,
  ): Promise<CouponDocument> {
    if (!Types.ObjectId.isValid(couponId)) throw new NotFoundException('Coupon not found')
    const coupon = await this.couponModel.findById(couponId)
    if (!coupon) throw new NotFoundException('Coupon not found')

    // Owner can only deactivate coupons they created for their own restaurant.
    const ownsCoupon  = coupon.createdBy.toString() === ownerId
    const scopedHere  = coupon.applicableRestaurants
      .some((id) => id.toString() === restaurantId)
    if (!ownsCoupon || !scopedHere) {
      throw new NotFoundException('Coupon not found')
    }

    coupon.isActive = false
    await coupon.save()
    return coupon
  }

  // ── Coupon validation (called by OrdersService at order placement) ──

  async validateCoupon(
    code: string,
    restaurantId: string,
    subtotalKobo: number,
    customerId?: string, // optional for preview calls that don't enforce per-user limit
  ): Promise<{ discountKobo: number; couponId: string }> {
    const coupon = await this.couponModel.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    })

    if (!coupon) throw new BadRequestException('Invalid or expired coupon code')

    // Read-only eligibility checks first — throwing here has no side effects,
    // so we can't leak reserved slots on min-order / restaurant-scope failures.
    if (subtotalKobo < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount for this coupon is ₦${(coupon.minOrderAmount / 100).toFixed(0)}`,
      )
    }

    if (
      coupon.applicableRestaurants.length > 0 &&
      !coupon.applicableRestaurants.some((id) => id.toString() === restaurantId)
    ) {
      throw new BadRequestException('Coupon is not valid for this restaurant')
    }

    // Preview path (no customerId): read-only limit checks, no reservations.
    if (!customerId) {
      if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
        throw new BadRequestException('Coupon usage limit has been reached')
      }
    } else {
      // Order path: atomic reservations. Global first, then per-user; if per-user
      // fails we roll back the global increment so no slot leaks.
      let globalReserved = false

      if (coupon.usageLimit > 0) {
        const reserved = await this.couponModel.findOneAndUpdate(
          { _id: coupon._id, usageCount: { $lt: coupon.usageLimit } },
          { $inc: { usageCount: 1 } },
        )
        if (!reserved) throw new BadRequestException('Coupon usage limit has been reached')
        globalReserved = true
      }

      if (coupon.perUserLimit > 0) {
        // Upsert-and-increment the per-user counter, then check the post-increment
        // value. If it exceeds the limit, roll back (both this increment and the
        // global one above). The compound unique index on (couponId, userId)
        // serialises concurrent upserts, closing the TOCTOU gap the old
        // countDocuments-then-create pattern left open.
        const userObjectId = new Types.ObjectId(customerId)
        const slot = await this.couponUserSlotModel.findOneAndUpdate(
          { couponId: coupon._id, userId: userObjectId },
          {
            $inc: { usedCount: 1 },
            $setOnInsert: { couponId: coupon._id, userId: userObjectId },
          },
          { upsert: true, new: true },
        )

        if (slot.usedCount > coupon.perUserLimit) {
          await this.couponUserSlotModel.updateOne(
            { couponId: coupon._id, userId: userObjectId },
            { $inc: { usedCount: -1 } },
          )
          if (globalReserved) {
            await this.couponModel.updateOne(
              { _id: coupon._id },
              { $inc: { usageCount: -1 } },
            )
          }
          throw new BadRequestException(
            coupon.perUserLimit === 1
              ? 'You have already used this coupon'
              : `You can only use this coupon ${coupon.perUserLimit} time${coupon.perUserLimit === 1 ? '' : 's'}`,
          )
        }
      }
    }

    let discountKobo = 0
    if (coupon.type === 'percentage') {
      discountKobo = Math.round(subtotalKobo * (coupon.value / 100))
    } else if (coupon.type === 'fixed_amount') {
      discountKobo = coupon.value
    } else {
      // free_delivery — discount equals the delivery fee; caller handles this
      discountKobo = 0 // OrdersService reads this as "waive delivery fee"
    }

    // Apply cap
    if (coupon.maxDiscount > 0) {
      discountKobo = Math.min(discountKobo, coupon.maxDiscount)
    }

    // Never discount more than the subtotal
    discountKobo = Math.min(discountKobo, subtotalKobo)

    return { discountKobo, couponId: coupon._id.toString() }
  }

  async getCouponByCode(code: string): Promise<CouponDocument | null> {
    return this.couponModel.findOne({ code: code.toUpperCase() }).lean() as unknown as CouponDocument | null
  }

  async recordCouponUsage(couponId: string, customerId: string, orderId: string): Promise<void> {
    // usageCount was already atomically incremented in validateCoupon — only create the
    // usage record here so revokeCouponUsage can find it on cancellation.
    await this.couponUsageModel.create({
      couponId: new Types.ObjectId(couponId),
      userId:   new Types.ObjectId(customerId),
      orderId:  new Types.ObjectId(orderId),
    })
  }

  // Called when an order using a coupon is cancelled — restores the user's usage slot.
  // Expects the usage record to exist (i.e. recordCouponUsage already ran successfully).
  async revokeCouponUsage(orderId: string): Promise<void> {
    const usage = await this.couponUsageModel.findOneAndDelete({ orderId: new Types.ObjectId(orderId) })
    if (usage) {
      await this.couponModel.findByIdAndUpdate(usage.couponId, { $inc: { usageCount: -1 } })
      await this.couponUserSlotModel.updateOne(
        { couponId: usage.couponId, userId: usage.userId },
        { $inc: { usedCount: -1 } },
      )
    }
  }

  // Decrements the coupon slot without requiring a usage record — used when the order
  // failed before recordCouponUsage could create one (save failure, stock exhaustion).
  // Pass customerId so the per-user reservation from validateCoupon is also released.
  async releaseCouponSlot(couponId: string, customerId?: string): Promise<void> {
    await this.couponModel.findByIdAndUpdate(couponId, { $inc: { usageCount: -1 } })
    if (customerId) {
      await this.couponUserSlotModel.updateOne(
        { couponId: new Types.ObjectId(couponId), userId: new Types.ObjectId(customerId) },
        { $inc: { usedCount: -1 } },
      )
    }
  }
}
