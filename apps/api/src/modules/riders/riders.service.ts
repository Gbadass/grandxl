import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { RiderDocument } from './schemas/rider.schema'
import { OrdersService } from '../orders/orders.service'
import { UsersService } from '../users/users.service'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { RegisterRiderDto } from './dto/register-rider.dto'
import type { UpdateLocationDto } from './dto/update-location.dto'
import type { UpdateAvailabilityDto } from './dto/update-availability.dto'
import type { UpdateDocumentsDto } from './dto/update-documents.dto'

@Injectable()
export class RidersService {
  constructor(
    @InjectModel(RiderDocument.name)
    private readonly riderModel: Model<RiderDocument>,
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
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

  async verifyRider(riderId: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: { isVerified: true } },
      { new: true },
    )
    if (!rider) throw new NotFoundException('Rider not found')
    return rider
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
