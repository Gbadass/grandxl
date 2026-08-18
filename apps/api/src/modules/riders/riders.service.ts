import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { RiderDocument } from './schemas/rider.schema'
import { OrdersService } from '../orders/orders.service'
import { UsersService } from '../users/users.service'
import { TermiiProvider } from '../auth/providers/termii.provider'
import { EmailProvider } from '../email/email.provider'
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
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly termii: TermiiProvider,
    private readonly email: EmailProvider,
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

    return this.riderModel.create({
      userId: new Types.ObjectId(userId),
      vehicleType: dto.vehicleType,
      vehiclePlate: dto.vehiclePlate ?? null,
    })
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
    const rider = await this.riderModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { isOnline: dto.isOnline, isAvailable: dto.isOnline } },
      { new: true },
    )
    if (!rider) throw new NotFoundException('Rider profile not found')

    // When a rider comes online, re-dispatch any orders stuck without a rider.
    // Fire-and-forget — don't delay the response waiting for queue operations.
    if (dto.isOnline) {
      void this.ordersService.redispatchUnassigned().catch(() => undefined)
    }

    return rider
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
    if (!rider.isOnline || !rider.isAvailable) {
      throw new BadRequestException('Rider is not available')
    }

    await this.ordersService.assignRider(orderId, riderId, rider.userId.toString())

    // Mark rider as busy until delivery completes
    await this.riderModel.findByIdAndUpdate(riderId, { $set: { isAvailable: false } })
  }

  async onDeliveryComplete(riderId: string): Promise<void> {
    await this.riderModel.findByIdAndUpdate(riderId, {
      $set: { isAvailable: true },
      $inc: { totalDeliveries: 1 },
    })
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

  // Rider voluntarily accepts a broadcast order — atomic first-writer-wins
  async acceptOrder(userId: string, orderId: string): Promise<void> {
    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) })
    if (!rider) throw new NotFoundException('Rider profile not found')
    if (!rider.isVerified) throw new ForbiddenException('Rider is not verified')
    if (!rider.isOnline) throw new BadRequestException('Rider must be online to accept orders')

    // assignRider throws ConflictException if another rider got there first
    await this.ordersService.assignRider(orderId, String(rider._id), rider.userId.toString())
    void this.riderModel.findByIdAndUpdate(rider._id, { $set: { isAvailable: false } }).catch(() => undefined)
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
      return this.riderModel.findOneAndUpdate(
        { userId },
        { $set: { vehicleType: dto.vehicleType, vehiclePlate: dto.vehiclePlate ?? null, isVerified: true } },
        { new: true },
      ) as Promise<RiderDocument>
    }

    return this.riderModel.create({
      userId,
      vehicleType:  dto.vehicleType,
      vehiclePlate: dto.vehiclePlate ?? null,
      isVerified:   true,
    })
  }

  async verifyRider(riderId: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { isVerified: true } },
      { new: true },
    )
    if (!rider) throw new NotFoundException('Rider not found')
    return rider
  }

  async suspendRider(riderId: string, dto: SuspendRiderDto): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (rider.terminatedAt) throw new BadRequestException('Cannot suspend a terminated rider')
    return this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { isSuspended: true, suspensionReason: dto.reason, isOnline: false, isAvailable: false } },
      { new: true },
    ) as Promise<RiderDocument>
  }

  async reinstateRider(riderId: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (rider.terminatedAt) throw new BadRequestException('Cannot reinstate a terminated rider')
    return this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { isSuspended: false, suspensionReason: null } },
      { new: true },
    ) as Promise<RiderDocument>
  }

  async terminateRider(riderId: string, dto: TerminateRiderDto): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(riderId)
    if (!rider) throw new NotFoundException('Rider not found')
    if (rider.terminatedAt) throw new BadRequestException('Rider is already terminated')
    return this.riderModel.findByIdAndUpdate(
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
    ) as Promise<RiderDocument>
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
