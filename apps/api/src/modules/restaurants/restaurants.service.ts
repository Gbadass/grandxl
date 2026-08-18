import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { RestaurantDocument } from './schemas/restaurant.schema'
import { RestaurantApprovalStatus, UserRole } from '@grandxl/types'
import { slugify } from '@grandxl/utils'
import type { CreateRestaurantDto } from './dto/create-restaurant.dto'
import type { UpdateRestaurantDto } from './dto/update-restaurant.dto'
import type { QueryRestaurantsDto } from './dto/query-restaurants.dto'
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '../../common/constants/app.constants'
import * as bcrypt from 'bcryptjs'
import { UsersService } from '../users/users.service'
import { EmailProvider } from '../email/email.provider'
import { TermiiProvider } from '../auth/providers/termii.provider'

export type SafeRestaurant = Omit<ReturnType<RestaurantDocument['toObject']>, 'bankDetails'>

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(RestaurantDocument.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly usersService: UsersService,
    private readonly email: EmailProvider,
    private readonly termii: TermiiProvider,
  ) {}

  // ── Slug generation ──────────────────────────────────────────────

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name)
    let slug = base
    let counter = 2
    while (await this.restaurantModel.findOne({ slug }).lean()) {
      slug = `${base}-${counter++}`
    }
    return slug
  }

  // ── Strip bank details for public/customer responses ─────────────

  toPublicRestaurant(doc: RestaurantDocument): SafeRestaurant {
    const obj = doc.toObject() as SafeRestaurant & { bankDetails?: unknown }
    delete obj.bankDetails
    return obj
  }

  // ── Create (restaurant owner) ────────────────────────────────────

  async create(ownerId: string, dto: CreateRestaurantDto): Promise<RestaurantDocument> {
    const slug = await this.generateUniqueSlug(dto.name)

    const restaurant = new this.restaurantModel({
      ownerId: new Types.ObjectId(ownerId),
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() ?? '',
      phone: dto.phone,
      email: dto.email?.toLowerCase().trim() ?? '',
      cuisine: dto.cuisine,
      address: {
        street: dto.address.street.trim(),
        city: dto.address.city.trim(),
        state: dto.address.state.trim(),
        country: dto.address.country ?? 'NG',
        coordinates: {
          type: 'Point',
          coordinates: [dto.address.coordinates.lng, dto.address.coordinates.lat],
        },
      },
      openingHours: dto.openingHours,
      deliveryRadius: dto.deliveryRadius ?? 5,
      minOrderAmount: dto.minOrderAmount ?? 0,
      deliveryFeeFixed: dto.deliveryFeeFixed ?? 100000,
      estimatedDeliveryTime: dto.estimatedDeliveryTime ?? 30,
      approvalStatus: RestaurantApprovalStatus.PENDING_REVIEW,
      isApproved: false,
    })

    const saved = await restaurant.save()

    // Fire confirmation email — non-blocking; failures must not break registration.
    const owner = await this.usersService.findById(ownerId)
    if (owner?.email) {
      void this.email.sendRestaurantRegistrationConfirmation(
        owner.email,
        owner.firstName,
        saved.name,
      )
    }

    return saved
  }

  // ── Read — customer-facing (isApproved + isActive always enforced) ─

  async findAll(query: QueryRestaurantsDto): Promise<{ data: SafeRestaurant[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT)
    const skip = (page - 1) * limit

    const baseFilter: Record<string, unknown> = { isApproved: true, isActive: true }
    if (query.cuisine) baseFilter.cuisine = { $in: [query.cuisine] }

    // Stage 1 — geo query when location is known
    // $geoNear aggregation used instead of $near+countDocuments because
    // countDocuments wraps in $match where $near is not permitted.
    if (query.lat !== undefined && query.lng !== undefined) {
      const geoNearStage = {
        $geoNear: {
          near: { type: 'Point' as const, coordinates: [query.lng, query.lat] as [number, number] },
          distanceField: 'dist',
          maxDistance: (query.radius ?? 10) * 1000,
          query: baseFilter,
          spherical: true,
        },
      }

      const [docs, countResult] = await Promise.all([
        this.restaurantModel.aggregate([geoNearStage, { $skip: skip }, { $limit: limit }]),
        this.restaurantModel.aggregate([geoNearStage, { $count: 'total' }]),
      ])

      const total = (countResult[0] as { total?: number } | undefined)?.total ?? 0

      // Stage 2 — fallback: no nearby results → return all approved restaurants
      // (covers mis-registered coordinates, test environments, and sparse areas)
      if (total > 0) {
        return {
          data: (docs as Array<Record<string, unknown>>).map((d) => {
            const { bankDetails: _, dist: __, ...safe } = d as Record<string, unknown> & { bankDetails?: unknown; dist?: unknown }
            return safe as SafeRestaurant
          }),
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }
      }
    }

    // No location provided, or geo returned 0 — show all approved restaurants
    // Weighted score: rating × log10(ratingCount + 1) so a 4.8 with 200 reviews
    // outranks a 5.0 with 1 review.
    const [docs, total] = await Promise.all([
      this.restaurantModel.aggregate([
        { $match: baseFilter },
        { $addFields: { _score: { $multiply: ['$rating', { $log: [{ $add: ['$ratingCount', 1] }, 10] }] } } },
        { $sort: { _score: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      this.restaurantModel.countDocuments(baseFilter),
    ])

    return {
      data: (docs as Array<Record<string, unknown>>).map((d) => {
        const { bankDetails: _, _score: __, ...safe } = d as Record<string, unknown> & { bankDetails?: unknown; _score?: unknown }
        return safe as SafeRestaurant
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async findById(id: string): Promise<RestaurantDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Restaurant not found')
    const doc = await this.restaurantModel.findOne({ _id: id, isApproved: true, isActive: true })
    if (!doc) throw new NotFoundException('Restaurant not found')
    return doc
  }

  // ── Read — owner/admin (no approval filter) ───────────────────────

  async findByIdRaw(id: string): Promise<RestaurantDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Restaurant not found')
    const doc = await this.restaurantModel.findById(id)
    if (!doc) throw new NotFoundException('Restaurant not found')
    return doc
  }

  async findByIdLean(id: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Restaurant not found')
    const doc = await this.restaurantModel.findById(id).lean()
    if (!doc) throw new NotFoundException('Restaurant not found')
    return doc as Record<string, unknown>
  }

  async findByOwner(ownerId: string): Promise<SafeRestaurant[]> {
    const docs = await this.restaurantModel.find({ ownerId: new Types.ObjectId(ownerId) }).lean()
    return docs.map((d) => {
      const { bankDetails: _, ...safe } = d as typeof d & { bankDetails?: unknown }
      return safe as SafeRestaurant
    })
  }

  // ── Update (owner — ownership enforced here) ─────────────────────

  async update(
    restaurantId: string,
    requesterId: string,
    requesterRoles: UserRole[],
    dto: UpdateRestaurantDto,
  ): Promise<RestaurantDocument> {
    const restaurant = await this.findByIdRaw(restaurantId)

    // Only owner or super_admin can update
    if (
      restaurant.ownerId.toString() !== requesterId &&
      !requesterRoles.includes(UserRole.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('You do not have permission to update this restaurant')
    }

    const updates: Record<string, unknown> = {}

    if (dto.name !== undefined) {
      updates.name = dto.name.trim()
      // Regenerate slug only if name changes
      updates.slug = await this.generateUniqueSlug(dto.name)
    }
    if (dto.description !== undefined) updates.description = dto.description.trim()
    if (dto.phone !== undefined) updates.phone = dto.phone
    if (dto.email !== undefined) updates.email = dto.email.toLowerCase().trim()
    if (dto.cuisine !== undefined) updates.cuisine = dto.cuisine
    if (dto.openingHours !== undefined) updates.openingHours = dto.openingHours
    if (dto.deliveryRadius !== undefined) updates.deliveryRadius = dto.deliveryRadius
    if (dto.minOrderAmount !== undefined) updates.minOrderAmount = dto.minOrderAmount
    if (dto.deliveryFeeFixed !== undefined) updates.deliveryFeeFixed = dto.deliveryFeeFixed
    if (dto.estimatedDeliveryTime !== undefined) updates.estimatedDeliveryTime = dto.estimatedDeliveryTime
    if (dto.isOpen !== undefined) updates.isOpen = dto.isOpen
    if (dto.coverImage !== undefined) updates.coverImage = dto.coverImage

    if (dto.address !== undefined) {
      updates.address = {
        street: dto.address.street.trim(),
        city: dto.address.city.trim(),
        state: dto.address.state.trim(),
        country: dto.address.country ?? 'NG',
        coordinates: {
          type: 'Point',
          coordinates: [dto.address.coordinates.lng, dto.address.coordinates.lat],
        },
      }
    }

    const updated = await this.restaurantModel
      .findByIdAndUpdate(restaurantId, { $set: updates }, { new: true })
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')
    return updated
  }

  // ── Submit for review (owner) ────────────────────────────────────

  async submitForReview(restaurantId: string, ownerId: string): Promise<RestaurantDocument> {
    const restaurant = await this.findByIdRaw(restaurantId)

    if (restaurant.ownerId.toString() !== ownerId) {
      throw new ForbiddenException('You do not have permission to submit this restaurant')
    }

    if (restaurant.approvalStatus === RestaurantApprovalStatus.APPROVED) {
      throw new BadRequestException('Restaurant is already approved')
    }

    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        { $set: { approvalStatus: RestaurantApprovalStatus.PENDING_REVIEW } },
        { new: true },
      )
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')
    return updated
  }

  // ── Admin — list by approval status ─────────────────────────────

  async findAllAdmin(status?: RestaurantApprovalStatus, page = 1, limit = 20): Promise<{
    data: RestaurantDocument[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }> {
    const filter: Record<string, unknown> = {}
    if (status) filter.approvalStatus = status

    const safeLimit = Math.min(limit, PAGINATION_MAX_LIMIT)
    const skip = (page - 1) * safeLimit

    const [data, total] = await Promise.all([
      this.restaurantModel.find(filter).skip(skip).limit(safeLimit).lean().exec(),
      this.restaurantModel.countDocuments(filter),
    ])

    return { data: data as unknown as RestaurantDocument[], meta: { total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) } }
  }

  // ── Admin — onboard (create pre-approved on behalf of owner) ─────

  async adminOnboard(
    dto: {
      ownerPhone: string
      ownerFirstName?: string
      ownerLastName?: string
      ownerEmail?: string
      ownerPassword?: string
      name: string
      phone: string
      email?: string
      description?: string
      cuisine: string[]
      address: { street: string; city: string; state: string; country?: string; lat?: number; lng?: number }
      minOrderAmount?: number
      estimatedDeliveryTime?: number
      deliveryFeeFixed?: number
      deliveryRadius?: number
    },
    adminId: string,
  ): Promise<RestaurantDocument> {
    let owner = await this.usersService.findByPhone(dto.ownerPhone)

    if (!owner) {
      if (!dto.ownerFirstName?.trim() || !dto.ownerLastName?.trim()) {
        throw new NotFoundException(
          `No GrandXL account found for ${dto.ownerPhone}. Provide ownerFirstName and ownerLastName to create one.`,
        )
      }

      if (!dto.ownerPassword) {
        throw new NotFoundException(
          `No GrandXL account found for ${dto.ownerPhone}. Provide ownerFirstName, ownerLastName and ownerPassword to create one.`,
        )
      }

      const passwordHash = await bcrypt.hash(dto.ownerPassword, 12)

      owner = await this.usersService.create({
        phone: dto.ownerPhone,
        firstName: dto.ownerFirstName.trim(),
        lastName: dto.ownerLastName.trim(),
        email: dto.ownerEmail?.trim().toLowerCase() || undefined,
        passwordHash,
        roles: [UserRole.RESTAURANT_OWNER],
      })

      // Fire-and-forget — outages must not block restaurant creation
      void this.termii.sendTransactional(
        dto.ownerPhone,
        `Hi ${dto.ownerFirstName.trim()}, your GrandXL restaurant owner account is ready. ` +
        `Login with your phone number and the password set for you by our team. ` +
        `Visit grandxl.com to get started.`,
      )

      if (dto.ownerEmail?.trim()) {
        void this.email.sendOwnerWelcomeCredentials(
          dto.ownerEmail.trim().toLowerCase(),
          dto.ownerFirstName.trim(),
          dto.name.trim(),
          dto.ownerPhone,
          dto.ownerPassword,
        )
      }
    }

    const slug = await this.generateUniqueSlug(dto.name)

    const lat = dto.address.lat ?? 6.5244
    const lng = dto.address.lng ?? 3.3792

    const restaurant = new this.restaurantModel({
      ownerId: owner._id,
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() ?? '',
      phone: dto.phone,
      email: dto.email?.toLowerCase().trim() ?? '',
      cuisine: dto.cuisine,
      address: {
        street: dto.address.street.trim(),
        city: dto.address.city.trim(),
        state: dto.address.state.trim(),
        country: dto.address.country ?? 'NG',
        coordinates: { type: 'Point', coordinates: [lng, lat] },
      },
      deliveryRadius: dto.deliveryRadius ?? 5,
      minOrderAmount: dto.minOrderAmount ?? 0,
      deliveryFeeFixed: dto.deliveryFeeFixed ?? 100000,
      estimatedDeliveryTime: dto.estimatedDeliveryTime ?? 30,
      approvalStatus: RestaurantApprovalStatus.APPROVED,
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: new Types.ObjectId(adminId),
      country: 'NG',
      currency: 'NGN',
    })

    await restaurant.save()

    if (!owner.roles.includes(UserRole.RESTAURANT_OWNER)) {
      await this.usersService.addRole(owner._id.toString(), UserRole.RESTAURANT_OWNER)
    }

    return restaurant
  }

  // ── Admin — approve ──────────────────────────────────────────────

  async approve(restaurantId: string, adminId: string): Promise<RestaurantDocument> {
    const restaurant = await this.findByIdRaw(restaurantId)

    if (restaurant.approvalStatus === RestaurantApprovalStatus.APPROVED) {
      throw new BadRequestException('Restaurant is already approved')
    }

    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        {
          $set: {
            isApproved: true,
            approvalStatus: RestaurantApprovalStatus.APPROVED,
            approvalNote: null,
            approvedAt: new Date(),
            approvedBy: new Types.ObjectId(adminId),
          },
        },
        { new: true },
      )
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')
    return updated
  }

  // ── Admin — reject ───────────────────────────────────────────────

  async reject(restaurantId: string, reason: string): Promise<RestaurantDocument> {
    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        {
          $set: {
            isApproved: false,
            approvalStatus: RestaurantApprovalStatus.REJECTED,
            approvalNote: reason,
          },
        },
        { new: true },
      )
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')
    return updated
  }

  // ── Admin — request more info ────────────────────────────────────

  async requestMoreInfo(restaurantId: string, message: string): Promise<RestaurantDocument> {
    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        {
          $set: {
            approvalStatus: RestaurantApprovalStatus.INFO_REQUESTED,
            approvalNote: message,
          },
        },
        { new: true },
      )
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')

    // Non-blocking email — registration must continue even if SendGrid is down.
    const owner = await this.usersService.findById(updated.ownerId.toString())
    if (owner?.email) {
      void this.email.sendRestaurantInfoRequest(
        owner.email,
        owner.firstName,
        updated.name,
        message,
      )
    }

    return updated
  }

  // ── Admin — suspend ──────────────────────────────────────────────

  async suspend(restaurantId: string, reason: string): Promise<RestaurantDocument> {
    const restaurant = await this.findByIdRaw(restaurantId)

    if (restaurant.approvalStatus !== RestaurantApprovalStatus.APPROVED) {
      throw new BadRequestException('Only approved restaurants can be suspended')
    }

    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        {
          $set: {
            isApproved: false,
            isOpen: false,
            approvalStatus: RestaurantApprovalStatus.SUSPENDED,
            approvalNote: reason,
          },
        },
        { new: true },
      )
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')
    return updated
  }

  // ── Used by SearchService ─────────────────────────────────────────

  async searchByText(
    q: string,
    page: number,
    limit: number,
    country?: string,
  ): Promise<RestaurantDocument[]> {
    const skip = (page - 1) * limit
    const filter: Record<string, unknown> = {
      $text: { $search: q },
      isApproved: true,
      isActive: true,
    }
    if (country) filter.country = country
    const results = await this.restaurantModel
      .find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .lean()
    return results as unknown as RestaurantDocument[]
  }

  async autocompleteByName(
    q: string,
    limit: number,
    country?: string,
  ): Promise<{ _id: string; name: string; slug: string; logo: string | null }[]> {
    const filter: Record<string, unknown> = {
      name: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' },
      isApproved: true,
      isActive: true,
    }
    if (country) filter.country = country
    const results = await this.restaurantModel
      .find(filter, { _id: 1, name: 1, slug: 1, logo: 1 })
      .limit(limit)
      .lean()
    return results as unknown as { _id: string; name: string; slug: string; logo: string | null }[]
  }

  // ── Admin — reinstate ────────────────────────────────────────────

  async reinstate(restaurantId: string, adminId: string): Promise<RestaurantDocument> {
    const restaurant = await this.findByIdRaw(restaurantId)

    if (restaurant.approvalStatus !== RestaurantApprovalStatus.SUSPENDED) {
      throw new BadRequestException('Only suspended restaurants can be reinstated')
    }

    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        {
          $set: {
            isApproved: true,
            approvalStatus: RestaurantApprovalStatus.APPROVED,
            approvalNote: null,
            approvedBy: new Types.ObjectId(adminId),
          },
        },
        { new: true },
      )
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')
    return updated
  }

  // ── Admin — terminate (permanent soft-delete) ────────────────────

  async terminate(restaurantId: string, reason: string, adminId: string): Promise<RestaurantDocument> {
    const restaurant = await this.findByIdRaw(restaurantId)

    if (restaurant.approvalStatus === RestaurantApprovalStatus.TERMINATED) {
      throw new BadRequestException('Restaurant is already terminated')
    }

    const updated = await this.restaurantModel
      .findByIdAndUpdate(
        restaurantId,
        {
          $set: {
            isApproved: false,
            isActive: false,
            isOpen: false,
            approvalStatus: RestaurantApprovalStatus.TERMINATED,
            terminatedAt: new Date(),
            terminatedBy: new Types.ObjectId(adminId),
            terminationReason: reason.trim(),
          },
        },
        { new: true },
      )
      .exec()

    if (!updated) throw new NotFoundException('Restaurant not found')
    return updated
  }
}
