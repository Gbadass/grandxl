import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { UserDocument } from './schemas/user.schema'
import { UserRole } from '@grandxl/types'
import type { UpdateProfileDto } from './dto/update-profile.dto'
import type { AddAddressDto } from './dto/add-address.dto'
import type { UpdateAddressDto } from './dto/update-address.dto'

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// Duplicate-key error code from MongoDB — thrown when the unique referralCode index rejects a collision.
const MONGO_DUP_KEY = 11000

// Detect a referralCode duplicate-key error specifically (vs. any other write failure).
function isReferralCodeDupError(err: unknown): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> } | null
  return !!e && e.code === MONGO_DUP_KEY && !!e.keyPattern?.['referralCode']
}

export interface CreateUserDto {
  firstName: string
  lastName: string
  phone?: string
  email?: string
  passwordHash?: string
  roles?: UserRole[]
  country?: string
  currency?: string
  locale?: string
  consentGiven?: boolean
  consentDate?: Date
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectModel(UserDocument.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    // The email_1 index was originally created without sparse:true, which means
    // any two users without an email address cause a duplicate key error (both
    // have email:null which the non-sparse index treats as a real value).
    // We drop it here so Mongoose rebuilds it as sparse on next ensureIndexes().
    try {
      const indexes = await this.userModel.collection.indexes()
      const emailIdx = indexes.find((i) => i.name === 'email_1')
      if (emailIdx && !emailIdx.sparse) {
        await this.userModel.collection.dropIndex('email_1')
        this.logger.log('Dropped non-sparse email_1 index — will be recreated as sparse')
      }
    } catch (err) {
      // Index may not exist — safe to ignore
      this.logger.warn(`Index migration skipped: ${(err as Error).message}`)
    }
    // Sync schema indexes (creates any missing ones, including the fixed email_1)
    await this.userModel.syncIndexes()
  }

  // ── Create ──────────────────────────────────────────────────────

  async create(dto: CreateUserDto): Promise<UserDocument> {
    if (dto.phone) {
      const existing = await this.userModel.findOne({ phone: dto.phone }).lean()
      if (existing) throw new ConflictException('Phone number already registered')
    }
    if (dto.email) {
      const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() }).lean()
      if (existing) throw new ConflictException('Email already registered')
    }

    // Omit null/undefined email and phone — the sparse unique indexes skip
    // missing fields, but explicitly stored `null` is treated as a value and
    // would conflict once a second user without email/phone is created.
    const baseData: Record<string, unknown> = {
      ...dto,
      roles: dto.roles ?? [UserRole.CUSTOMER],
    }
    if (!baseData['email']) delete baseData['email']
    if (!baseData['phone']) delete baseData['phone']

    // Referral code retry loop — the 8-char Math.random code has ~1% collision
    // odds at ~2M users. The unique index would otherwise throw a raw dup-key
    // error on registration; retry with a fresh code so users don't fail silently.
    // 5 attempts covers >99.99% of realistic collision fanout.
    const MAX_ATTEMPTS = 5
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const user = new this.userModel({
          ...baseData,
          referralCode: generateReferralCode(),
        })
        return await user.save()
      } catch (err) {
        if (isReferralCodeDupError(err) && attempt < MAX_ATTEMPTS) {
          this.logger.warn(`Referral code collision on attempt ${attempt}, retrying`)
          continue
        }
        throw err
      }
    }
    // Unreachable — either return or throw inside the loop
    throw new Error('Failed to generate unique referral code after retries')
  }

  // ── Read ────────────────────────────────────────────────────────

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null
    return this.userModel.findById(id).exec()
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec()
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec()
  }

  async findByReferralCode(code: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ referralCode: code.toUpperCase() }).exec()
  }

  async findByIdOrThrow(id: string): Promise<UserDocument> {
    const user = await this.findById(id)
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async findAllByRole(role: string): Promise<UserDocument[]> {
    return this.userModel.find({ roles: role }).lean() as unknown as UserDocument[]
  }

  // ── Profile update ───────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDocument> {
    // Email and phone deliberately excluded from this path — see UpdateProfileDto
    // comment. Use AuthService.requestEmailChange / requestPhoneChange for those.
    const updates: Record<string, unknown> = {}
    if (dto.firstName !== undefined) updates.firstName = dto.firstName.trim()
    if (dto.lastName !== undefined) updates.lastName = dto.lastName.trim()
    if (dto.avatar !== undefined) updates.avatar = dto.avatar

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: updates }, { new: true })
      .exec()

    if (!user) throw new NotFoundException('User not found')
    return user
  }

  // ── Addresses ────────────────────────────────────────────────────

  async addAddress(userId: string, dto: AddAddressDto): Promise<UserDocument> {
    const user = await this.findByIdOrThrow(userId)

    user.addresses.push({
      label: dto.label,
      street: dto.street,
      city: dto.city,
      state: dto.state,
      country: dto.country ?? 'NG',
      ...(dto.coordinates
        ? { coordinates: { type: 'Point', coordinates: [dto.coordinates.lng, dto.coordinates.lat] } }
        : {}),
      instructions: dto.instructions ?? null,
    } as never)

    // Auto-set as default if this is the user's first address
    if (user.addresses.length === 1) {
      user.defaultAddressId = user.addresses[0]._id
    }

    await user.save()
    return user
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<UserDocument> {
    const user = await this.findByIdOrThrow(userId)
    const address = user.addresses.find((a) => a._id.toString() === addressId)
    if (!address) throw new NotFoundException('Address not found')

    if (dto.label !== undefined) address.label = dto.label
    if (dto.street !== undefined) address.street = dto.street
    if (dto.city !== undefined) address.city = dto.city
    if (dto.state !== undefined) address.state = dto.state
    if (dto.country !== undefined) address.country = dto.country
    if (dto.instructions !== undefined) address.instructions = dto.instructions
    if (dto.coordinates !== undefined) {
      address.coordinates = {
        type: 'Point',
        coordinates: [dto.coordinates.lng, dto.coordinates.lat],
      }
    }

    await user.save()
    return user
  }

  async deleteAddress(userId: string, addressId: string): Promise<UserDocument> {
    const user = await this.findByIdOrThrow(userId)
    const idx = user.addresses.findIndex((a) => a._id.toString() === addressId)
    if (idx === -1) throw new NotFoundException('Address not found')

    user.addresses.splice(idx, 1)

    // If deleted address was the default, promote the first remaining one
    if (user.defaultAddressId?.toString() === addressId) {
      user.defaultAddressId = user.addresses.length > 0 ? user.addresses[0]._id : null
    }

    await user.save()
    return user
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<UserDocument> {
    const user = await this.findByIdOrThrow(userId)
    const exists = user.addresses.some((a) => a._id.toString() === addressId)
    if (!exists) throw new NotFoundException('Address not found')

    user.defaultAddressId = new Types.ObjectId(addressId)
    await user.save()
    return user
  }

  // ── Push tokens ──────────────────────────────────────────────────

  async updateExpoPushToken(userId: string, token: string | null): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { expoPushToken: token })
  }

  async clearExpoPushToken(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $unset: { expoPushToken: '' } })
  }

  async saveWebPushSubscription(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    // Remove any existing subscription with the same endpoint first ($addToSet doesn't deep-compare)
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { webPushSubscriptions: { endpoint: sub.endpoint } } },
    )
    // Add new subscription and keep at most 10 (oldest dropped first)
    await this.userModel.updateOne(
      { _id: userId },
      { $push: { webPushSubscriptions: { $each: [sub], $slice: -10 } } },
    )
  }

  async removeWebPushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { webPushSubscriptions: { endpoint } } },
    )
  }

  async getWebPushSubscriptions(
    userId: string,
  ): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>> {
    const user = await this.userModel.findById(userId).select('webPushSubscriptions').lean()
    return (user as { webPushSubscriptions?: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> })?.webPushSubscriptions ?? []
  }

  async removeExpiredWebPushSubscriptions(userId: string, endpoints: string[]): Promise<void> {
    if (endpoints.length === 0) return
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { webPushSubscriptions: { endpoint: { $in: endpoints } } } },
    )
  }

  // ── Preferences ──────────────────────────────────────────────────

  async updatePreferences(userId: string, prefs: { smsOptIn?: boolean }): Promise<void> {
    const update: Record<string, unknown> = {}
    if (typeof prefs.smsOptIn === 'boolean') update['smsOptIn'] = prefs.smsOptIn
    if (Object.keys(update).length === 0) return
    await this.userModel.updateOne({ _id: userId }, { $set: update })
  }

  // ── Admin ────────────────────────────────────────────────────────

  async listUsers(page: number, limit: number, search?: string) {
    const filter: Record<string, unknown> = { deletedAt: null }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, 'i')
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { phone: re }]
    }
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.userModel.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.userModel.countDocuments(filter),
    ])
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  // Fraud dashboard (S13-10): paginated list of users with at least one risk
  // flag, sorted by most recent flag first. Optional `code` filter narrows to a
  // specific rule (e.g. 'payment_failures_24h'). Search matches name/email/phone
  // like listUsers so ops can jump straight to a known user.
  async listFlaggedUsers(page: number, limit: number, code?: string, search?: string) {
    const filter: Record<string, unknown> = {
      deletedAt: null,
      // $exists + $ne to catch schemas where the field is absent on old docs.
      riskFlags: { $exists: true, $ne: [] },
    }
    if (code) {
      filter['riskFlags.code'] = code
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, 'i')
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { phone: re }]
    }
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      // Sort by most recent flag createdAt — we compute per-doc via aggregation
      // for cheap ordering without a schema change. Small page sizes → fine.
      this.userModel
        .aggregate([
          { $match: filter },
          { $addFields: { latestFlagAt: { $max: '$riskFlags.createdAt' } } },
          { $sort: { latestFlagAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { passwordHash: 0 } },
        ]),
      this.userModel.countDocuments(filter),
    ])
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async banUser(id: string, reason: string, actorId: string): Promise<void> {
    const user = await this.findByIdOrThrow(id)
    await this.userModel.updateOne(
      { _id: user._id },
      {
        isActive:  false,
        banReason: reason,
        bannedAt:  new Date(),
        bannedBy:  new Types.ObjectId(actorId),
      },
    )
  }

  async unbanUser(id: string): Promise<void> {
    const user = await this.findByIdOrThrow(id)
    await this.userModel.updateOne(
      { _id: user._id },
      {
        isActive:  true,
        banReason: null,
        bannedAt:  null,
        bannedBy:  null,
      },
    )
  }

  // Paginated list of currently-banned customers (isActive=false, not deleted).
  // Used by S13-13 blocklist page. Sort by most-recent ban so triage sees the
  // freshest actions on top. Includes bannedBy populated with actor first/last
  // name so the UI can show "Blocked by <name>" without a second lookup.
  async listBannedUsers(page: number, limit: number, search?: string) {
    const filter: Record<string, unknown> = { isActive: false, deletedAt: null }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, 'i')
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { phone: re }]
    }
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash')
        .populate('bannedBy', 'firstName lastName')
        .sort({ bannedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ])
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  // ── Auth helpers (called by AuthService) ────────────────────────

  async markVerified(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { isVerified: true })
  }

  async addRole(userId: string, role: UserRole): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $addToSet: { roles: role } })
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { passwordHash })
  }

  // Callers must have already verified re-authorization (OTP for phone,
  // verification link for email). Uniqueness re-checked at the DB level via
  // the sparse unique indexes — dup keys bubble up as raw mongo errors.
  async updateEmail(userId: string, newEmail: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { email: newEmail.toLowerCase().trim() } })
  }

  async updatePhone(userId: string, newPhone: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { phone: newPhone } })
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { lastLoginAt: new Date() })
  }

  // ── NDPR — Part 31 ───────────────────────────────────────────────

  async softDeleteAccount(userId: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId)
    if (user.deletedAt) throw new BadRequestException('Account is already scheduled for deletion')

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          firstName: 'Deleted',
          lastName: 'User',
          email: `deleted_${userId}@grandxl.com`,
          phone: `deleted_${userId}`,
          avatar: null,
          expoPushToken: null,
          addresses: [],
          defaultAddressId: null,
          isActive: false,
          deletedAt: new Date(),
        },
      },
    )
  }

  // ── Favorites ────────────────────────────────────────────────────

  async addFavorite(userId: string, restaurantId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $addToSet: { favoriteRestaurantIds: new Types.ObjectId(restaurantId) } },
    )
  }

  async removeFavorite(userId: string, restaurantId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $pull: { favoriteRestaurantIds: new Types.ObjectId(restaurantId) } },
    )
  }

  async listFavoriteIds(userId: string): Promise<string[]> {
    const user = await this.userModel
      .findById(userId, { favoriteRestaurantIds: 1 })
      .lean()
      .exec() as { favoriteRestaurantIds?: Types.ObjectId[] } | null
    return (user?.favoriteRestaurantIds ?? []).map((id) => id.toString())
  }

  // ── Helpers ──────────────────────────────────────────────────────

  async toSafeUser(user: UserDocument): Promise<Omit<UserDocument, 'passwordHash'>> {
    const obj = user.toObject() as UserDocument & { passwordHash?: string; role?: UserRole; roles?: UserRole[] }
    // Legacy fallback — older docs may carry `role` (singular). Migration backfills roles[].
    if ((!obj.roles || obj.roles.length === 0) && obj.role) {
      obj.roles = [obj.role]
    }
    delete obj.role
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...safe } = obj
    return safe as Omit<UserDocument, 'passwordHash'>
  }
}
