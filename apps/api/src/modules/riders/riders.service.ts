import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types, type MongooseError } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { RiderDocument } from './schemas/rider.schema'
import { RiderOnlineSessionDocument } from './schemas/rider-online-session.schema'
import { OrdersService } from '../orders/orders.service'
import { UsersService } from '../users/users.service'
import { TermiiProvider } from '../auth/providers/termii.provider'
import { EmailProvider } from '../email/email.provider'
import { NotificationsService } from '../notifications/notifications.service'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { RegisterRiderDto } from './dto/register-rider.dto'
import type { UpdateLocationDto } from './dto/update-location.dto'
import type { UpdateAvailabilityDto } from './dto/update-availability.dto'
import type { UpdateDocumentsDto } from './dto/update-documents.dto'
import type { AdminOnboardRiderDto } from './dto/admin-onboard-rider.dto'
import type { SuspendRiderDto } from './dto/suspend-rider.dto'
import type { TerminateRiderDto } from './dto/terminate-rider.dto'

@Injectable()
export class RidersService {
  constructor(
    @InjectModel(RiderDocument.name)
    private readonly riderModel: Model<RiderDocument>,
    @InjectModel(RiderOnlineSessionDocument.name)
    private readonly sessionModel: Model<RiderOnlineSessionDocument>,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly termii: TermiiProvider,
    private readonly email: EmailProvider,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Profile ──────────────────────────────────────────────────────

  async register(userId: string, dto: RegisterRiderDto): Promise<RiderDocument> {
    const existing = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) })

    // Always ensure RIDER role is on the user — $addToSet is idempotent so safe to call every time.
    // This covers users who have a rider profile but somehow lost the role (data inconsistency).
    await this.usersService.addRole(userId, UserRole.RIDER)

    if (existing) {
      // Idempotent — update vehicle info and return existing profile instead of throwing
      return this.riderModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { vehicleType: dto.vehicleType, vehiclePlate: dto.vehiclePlate ?? null } },
        { new: true },
      ) as Promise<RiderDocument>
    }

    const created = await this.riderModel.create({
      userId: new Types.ObjectId(userId),
      vehicleType: dto.vehicleType,
      vehiclePlate: dto.vehiclePlate ?? null,
    })

    void (async () => {
      const user = await this.usersService.findById(userId).catch(() => null)
      if (user) {
        void this.notifications.onRiderRegistered(
          String(created._id),
          `${user.firstName} ${user.lastName}`,
        ).catch(() => undefined)
      }
    })()

    return created
  }

  async getProfile(userId: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) })
    if (!rider) throw new NotFoundException('Rider profile not found')
    return rider
  }

  async getProfileById(riderId: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(riderId)) throw new NotFoundException('Rider not found')
    const rider = await this.riderModel
      .findById(riderId)
      .populate('userId', 'firstName lastName phone email avatar')
      .lean()
    if (!rider) throw new NotFoundException('Rider not found')
    return rider as Record<string, unknown>
  }

  // ── Availability & location ──────────────────────────────────────

  async updateAvailability(userId: string, dto: UpdateAvailabilityDto): Promise<RiderDocument> {
    // Atomic state-change: single findOneAndUpdate with a prev-state filter tells us
    // definitively whether THIS call was the one that flipped the flag. Two concurrent
    // requests can no longer create a duplicate session (only one matches the filter).
    const oppositeState = !dto.isOnline
    const flipped = await this.riderModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), isOnline: oppositeState },
      { $set: { isOnline: dto.isOnline, isAvailable: dto.isOnline } },
      { new: true },
    )

    // If the flip didn't match, either (a) the rider is already in the requested state
    // (no-op — return the current doc), or (b) the profile doesn't exist.
    if (!flipped) {
      const existing = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) })
      if (!existing) throw new NotFoundException('Rider profile not found')
      return existing
    }

    // We were the flipper — safe to write exactly one session-lifecycle event.
    // Best-effort: a session-write failure must not fail the API call.
    if (dto.isOnline) {
      void this.sessionModel.create({
        riderId: flipped._id,
        userId:  new Types.ObjectId(userId),
        startAt: new Date(),
        endAt:   null,
      }).catch(() => undefined)
    } else {
      void this.closeOpenSession(flipped._id as Types.ObjectId)
    }

    // When a rider comes online, re-dispatch any orders stuck without a rider.
    // Fire-and-forget — don't delay the response waiting for queue operations.
    if (dto.isOnline) {
      void this.ordersService.redispatchUnassigned().catch(() => undefined)
    }

    return flipped
  }

  async updateLocation(userId: string, dto: UpdateLocationDto): Promise<void> {
    const result = await this.riderModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          currentLocation: {
            type: 'Point',
            coordinates: [dto.lng, dto.lat],
            bearing: dto.bearing,
            updatedAt: new Date(),
          },
        },
      },
    )
    if (result.matchedCount === 0) throw new NotFoundException('Rider profile not found')
  }

  // ── KYC documents (rider submits after uploading via /uploads) ───

  async updateDocuments(userId: string, dto: UpdateDocumentsDto): Promise<RiderDocument> {
    const updates: Record<string, unknown> = {}
    if (dto.idCard !== undefined) updates['documents.idCard'] = dto.idCard
    if (dto.driverLicense !== undefined) updates['documents.driverLicense'] = dto.driverLicense
    if (dto.vehiclePhoto !== undefined) updates['documents.vehiclePhoto'] = dto.vehiclePhoto

    const rider = await this.riderModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: updates },
      { new: true },
    )
    if (!rider) throw new NotFoundException('Rider profile not found')
    return rider
  }

  // ── Job assignment (called by admin or auto-dispatch) ────────────

  async assignOrder(riderId: string, orderId: string): Promise<void> {
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (!rider.isVerified) throw new ForbiddenException('Rider is not verified')
    if (!rider.isOnline) throw new BadRequestException('Rider is offline')

    // Auto-heal: same logic as acceptOrder — reset a stuck unavailable flag if the
    // rider has no genuinely active order. Allows admins to assign a rider whose
    // isAvailable got stuck false after an edge-case cancellation.
    if (!rider.isAvailable) {
      const activeOrder = await this.ordersService.findActiveOrderByRider(String(rider._id))
      if (!activeOrder) {
        await this.riderModel.findByIdAndUpdate(rider._id, { $set: { isAvailable: true } })
      }
    }

    // Atomically claim the rider slot — prevents two concurrent admin assigns from
    // both passing the availability check (TOCTOU guard, same as acceptOrder).
    const claimed = await this.riderModel.findOneAndUpdate(
      { _id: rider._id, isAvailable: true },
      { $set: { isAvailable: false } },
    )
    if (!claimed) throw new BadRequestException('Rider is not available')

    try {
      await this.ordersService.assignRider(orderId, riderId, rider.userId.toString())
    } catch (err) {
      void this.riderModel.findByIdAndUpdate(rider._id, { $set: { isAvailable: true } }).catch(() => undefined)
      throw err
    }
  }

  async releaseRider(riderId: string): Promise<void> {
    await this.riderModel.findByIdAndUpdate(riderId, { $set: { isAvailable: true } })
  }

  // Sprint 13 (S13-4): typed core-fields lookup for reassign pre-flight — the
  // existing getProfileById returns Record<string, unknown> which is fine for
  // rendering but not for the isVerified/isOnline checks the reassign flow runs.
  async getRiderCore(riderId: string): Promise<{
    _id: Types.ObjectId; userId: Types.ObjectId
    isVerified: boolean; isOnline: boolean; isAvailable: boolean
  } | null> {
    if (!Types.ObjectId.isValid(riderId)) return null
    const rider = await this.riderModel
      .findById(riderId, { userId: 1, isVerified: 1, isOnline: 1, isAvailable: 1 })
      .lean() as unknown as {
        _id: Types.ObjectId; userId: Types.ObjectId
        isVerified: boolean; isOnline: boolean; isAvailable: boolean
      } | null
    return rider
  }

  // Sprint 13 (S13-4): atomic isAvailable claim by rider id, used by admin
  // reassign to guarantee two concurrent admin actions can't both grab the
  // same rider (matches the TOCTOU pattern in assignOrder above).
  async acquireRiderForReassign(riderId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(riderId)) return false
    const claimed = await this.riderModel.findOneAndUpdate(
      { _id: new Types.ObjectId(riderId), isAvailable: true, isOnline: true, isVerified: true },
      { $set: { isAvailable: false } },
    )
    return !!claimed
  }

  // Sprint 13 (S13-4): rider picker for the admin reassign modal. Returns
  // online + available + verified riders sorted by distance from an anchor
  // point (typically the order's pickup coordinates). Radius default is wider
  // than the auto-dispatch pool because admin intervention often means
  // "grab whoever is closest, even if they're farther than the usual radius".
  async findAvailableNear(
    lng: number,
    lat: number,
    limit = 20,
    radiusMeters = 20_000,
  ): Promise<Array<{
    _id: Types.ObjectId; userId: Types.ObjectId
    vehicleType: string; vehiclePlate: string | null
    location: { coordinates: [number, number] } | null
  }>> {
    return this.riderModel
      .find({
        isOnline: true,
        isAvailable: true,
        isVerified: true,
        isSuspended: { $ne: true },
        currentLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusMeters,
          },
        },
      }, { userId: 1, vehicleType: 1, vehiclePlate: 1, currentLocation: 1 })
      .populate('userId', 'firstName lastName phone')
      .limit(Math.min(limit, 50))
      .lean() as unknown as Array<{
        _id: Types.ObjectId; userId: Types.ObjectId
        vehicleType: string; vehiclePlate: string | null
        location: { coordinates: [number, number] } | null
      }>
  }

  async onDeliveryComplete(riderId: string, earningsKobo: number): Promise<void> {
    // Money enters pendingKobo (24h hold). Settlement will move it to totalKobo.
    // Do NOT increment totalKobo here — settlement.service does that atomically.
    await this.riderModel.findByIdAndUpdate(riderId, {
      $set: { isAvailable: true },
      $inc: {
        totalDeliveries:        1,
        'earnings.pendingKobo': earningsKobo,
      },
    })
  }

  async getUserIdByRiderId(riderId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(riderId)) return null
    const rider = await this.riderModel.findById(riderId, { userId: 1 }).lean()
    return rider ? (rider.userId as Types.ObjectId).toString() : null
  }

  // Moves earned kobo from pendingKobo to totalKobo — called by nightly settlement.
  // Guards against pendingKobo going negative: if the rider's pending balance is below
  // the expected amount (data inconsistency), the update is skipped for that rider.
  async settleEarnings(riderId: string, amountKobo: number): Promise<void> {
    await this.riderModel.findOneAndUpdate(
      { _id: new Types.ObjectId(riderId), 'earnings.pendingKobo': { $gte: amountKobo } },
      { $inc: { 'earnings.totalKobo': amountKobo, 'earnings.pendingKobo': -amountKobo } },
    )
  }

  // ── Find nearest available rider (used by auto-dispatch) ──────────

  async findNearestAvailable(
    lng: number,
    lat: number,
    radiusMeters = 5000,
  ): Promise<RiderDocument[]> {
    return this.riderModel
      .find({
        isOnline: true,
        isAvailable: true,
        isVerified: true,
        currentLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusMeters,
          },
        },
      })
      .limit(5)
      .lean() as unknown as RiderDocument[]
  }

  // Finds all online+verified riders in region regardless of availability status
  async findNearbyOnlineVerified(
    lng: number,
    lat: number,
    radiusMeters = 50_000,
  ): Promise<RiderDocument[]> {
    return this.riderModel
      .find({
        isOnline: true,
        isVerified: true,
        currentLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusMeters,
          },
        },
      })
      .limit(50)
      .lean() as unknown as RiderDocument[]
  }

  // Fallback when no riders have a currentLocation saved yet — returns all online+verified
  // riders regardless of geo position. Used so dispatch still works when riders haven't
  // shared their location (e.g. first run, location permission not yet granted).
  async findAllOnlineVerified(): Promise<RiderDocument[]> {
    return this.riderModel
      .find({ isOnline: true, isVerified: true })
      .limit(50)
      .lean() as unknown as RiderDocument[]
  }

  // Rider voluntarily accepts a broadcast order — atomic first-writer-wins.
  // We use findOneAndUpdate with isAvailable:true as a filter condition so that
  // two concurrent accept calls cannot both claim the same rider slot (TOCTOU fix).
  async acceptOrder(userId: string, orderId: string): Promise<void> {
    // Fetch profile first to surface meaningful errors (not found, not verified, offline).
    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) })
    if (!rider) throw new NotFoundException('Rider profile not found')
    if (!rider.isVerified) throw new ForbiddenException('Rider is not verified')
    if (!rider.isOnline)   throw new BadRequestException('Rider must be online to accept orders')

    // Auto-heal: if the rider's isAvailable flag is stuck false (e.g. a previous order was
    // cancelled or the delivery-complete flow never fired), reset it if they have no
    // genuinely active order in the database. This prevents riders from being permanently
    // locked out after edge-case failures without opening a race condition (the actual
    // atomic claim below is still the TOCTOU guard).
    if (!rider.isAvailable) {
      const activeOrder = await this.ordersService.findActiveOrderByRider(String(rider._id))
      if (!activeOrder) {
        await this.riderModel.findByIdAndUpdate(rider._id, { $set: { isAvailable: true } })
      }
    }

    // Atomically mark rider as busy. If another concurrent request beat us here,
    // findOneAndUpdate returns null (no document matched isAvailable:true) and we surface
    // a clear error instead of letting two orders both think they own the same rider.
    const claimed = await this.riderModel.findOneAndUpdate(
      { _id: rider._id, isAvailable: true },
      { $set: { isAvailable: false } },
    )
    if (!claimed) throw new BadRequestException('You are currently busy with another delivery')

    try {
      // assignRider throws ConflictException if another rider already claimed the order
      await this.ordersService.assignRider(orderId, String(rider._id), rider.userId.toString())
    } catch (err) {
      // Release the rider's availability lock if order assignment fails (order already taken, etc.)
      void this.riderModel.findByIdAndUpdate(rider._id, { $set: { isAvailable: true } }).catch(() => undefined)
      throw err
    }
  }

  // Rider declines a broadcast job — recorded so they don't see it again on the next poll.
  // If re-dispatch is needed (all riders declined), ordersService.redispatchUnassigned handles it.
  async declineOrder(userId: string, orderId: string): Promise<void> {
    await this.ordersService.recordDecline(orderId, userId)
  }

  // ── Admin ────────────────────────────────────────────────────────

  async adminOnboard(dto: AdminOnboardRiderDto, adminId: string): Promise<RiderDocument> {
    let existingUser = await this.usersService.findByPhone(dto.riderPhone)

    if (!existingUser) {
      if (!dto.riderFirstName || !dto.riderLastName || !dto.riderPassword) {
        throw new BadRequestException(
          'riderFirstName, riderLastName and riderPassword are required when the phone is not yet registered',
        )
      }
      const passwordHash = await bcrypt.hash(dto.riderPassword, 12)
      existingUser = await this.usersService.create({
        phone:        dto.riderPhone,
        firstName:    dto.riderFirstName,
        lastName:     dto.riderLastName,
        email:        dto.riderEmail,
        passwordHash,
        roles:        [UserRole.CUSTOMER, UserRole.RIDER],
        consentGiven: true,
        consentDate:  new Date(),
      })

      // Fire-and-forget: SMS welcome
      void this.termii.sendTransactional(
        dto.riderPhone,
        `Welcome to GrandXL Riders, ${dto.riderFirstName}! Your account has been created by our team. Login with your phone number and the password provided to you. Download the GrandXL Rider app to get started.`,
      ).catch(() => undefined)

      // Fire-and-forget: email welcome if provided
      if (dto.riderEmail) {
        void this.email.sendOwnerWelcomeCredentials(
          dto.riderEmail,
          dto.riderFirstName,
          'GrandXL Rider',
          dto.riderPhone,
          dto.riderPassword,
        ).catch(() => undefined)
      }
    } else {
      await this.usersService.addRole(existingUser._id.toString(), UserRole.RIDER)
    }

    const userId = existingUser._id as Types.ObjectId

    const existing = await this.riderModel.findOne({ userId })
    if (existing) {
      if (existing.terminatedAt) {
        throw new ForbiddenException(
          'This rider account has been terminated. Use the Reinstate action on their profile to re-activate.',
        )
      }
      const updated = await this.riderModel.findOneAndUpdate(
        { userId },
        { $set: { vehicleType: dto.vehicleType, vehiclePlate: dto.vehiclePlate ?? null, isVerified: true } },
        { new: true },
      )
      if (!updated) throw new NotFoundException('Rider profile not found — please try again.')
      return updated
    }

    try {
      return await this.riderModel.create({
        userId,
        vehicleType:  dto.vehicleType,
        vehiclePlate: dto.vehiclePlate ?? null,
        isVerified:   true,
      })
    } catch (err) {
      const mongoErr = err as MongooseError & { code?: number }
      if (mongoErr.code === 11000) {
        throw new ConflictException('A rider profile already exists for this account.')
      }
      throw new InternalServerErrorException(
        mongoErr.message ?? 'Failed to create rider profile.',
      )
    }
  }

  async verifyRider(riderId: string): Promise<RiderDocument> {
    // Sprint 13 (S13-7): verifying clears any prior KYC rejection so a rider
    // who re-uploaded after a bounce doesn't show a stale rejection banner.
    const rider = await this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { isVerified: true, kycRejectionReason: null, kycRejectedAt: null } },
      { new: true },
    )
    if (!rider) throw new NotFoundException('Rider not found')
    void this.notifications.onAdminActionOnRider(rider.userId.toString(), 'verified').catch(() => undefined)
    return rider
  }

  // Sprint 13 (S13-7): reject a rider's KYC with a reason so they know what
  // to fix and re-upload. Does NOT touch isVerified (was already false) —
  // just stamps the reason + timestamp so the rider PWA can render a banner
  // and admin can filter for pending vs rejected in the queue.
  async rejectKyc(riderId: string, reason: string): Promise<RiderDocument> {
    if (!Types.ObjectId.isValid(riderId)) throw new NotFoundException('Rider not found')
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (rider.isVerified) {
      throw new BadRequestException('Cannot reject KYC on a verified rider — suspend or terminate instead.')
    }
    const updated = await this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { kycRejectionReason: reason, kycRejectedAt: new Date() } },
      { new: true },
    ) as RiderDocument
    void this.notifications.onAdminActionOnRider(updated.userId.toString(), 'kyc_rejected', reason).catch(() => undefined)
    return updated
  }

  // Best-effort: close any currently open online session for this rider.
  // Called whenever the rider is force-taken-offline by an admin action so their
  // session doesn't sit open indefinitely, inflating utilization metrics.
  private async closeOpenSession(riderObjectId: Types.ObjectId): Promise<void> {
    await this.sessionModel.findOneAndUpdate(
      { riderId: riderObjectId, endAt: null },
      { $set: { endAt: new Date() } },
      { sort: { startAt: -1 } },
    ).catch(() => undefined)
  }

  async suspendRider(riderId: string, dto: SuspendRiderDto): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (rider.terminatedAt) throw new BadRequestException('Cannot suspend a terminated rider')
    const suspended = await this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { isSuspended: true, suspensionReason: dto.reason, isOnline: false, isAvailable: false } },
      { new: true },
    ) as RiderDocument
    void this.closeOpenSession(suspended._id as Types.ObjectId)
    void this.notifications.onAdminActionOnRider(suspended.userId.toString(), 'suspended', dto.reason).catch(() => undefined)
    return suspended
  }

  async reinstateRider(riderId: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (rider.terminatedAt) throw new BadRequestException('Cannot reinstate a terminated rider')
    const reinstated = await this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { isSuspended: false, suspensionReason: null } },
      { new: true },
    ) as RiderDocument
    void this.notifications.onAdminActionOnRider(reinstated.userId.toString(), 'reinstated').catch(() => undefined)
    return reinstated
  }

  async terminateRider(riderId: string, dto: TerminateRiderDto): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (rider.terminatedAt) throw new BadRequestException('Rider is already terminated')
    const terminated = await this.riderModel.findByIdAndUpdate(
      riderId,
      {
        $set: {
          terminatedAt:      new Date(),
          terminationReason: dto.reason,
          isSuspended:       false,
          suspensionReason:  null,
          isVerified:        false,
          isOnline:          false,
          isAvailable:       false,
        },
      },
      { new: true },
    ) as RiderDocument
    void this.closeOpenSession(terminated._id as Types.ObjectId)
    void this.notifications.onAdminActionOnRider(terminated.userId.toString(), 'terminated').catch(() => undefined)
    return terminated
  }

  async listRiders(page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.riderModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName phone email avatar')
        .lean(),
      this.riderModel.countDocuments(),
    ])
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }
}
