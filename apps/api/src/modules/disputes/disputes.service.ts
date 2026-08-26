import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { DisputeDocument, DisputeStatus } from './schemas/dispute.schema'
import type { CreateDisputeDto, UpdateDisputeDto } from './dto/dispute.dto'
import { OrdersService } from '../orders/orders.service'

@Injectable()
export class DisputesService {
  constructor(
    @InjectModel(DisputeDocument.name)
    private readonly disputeModel: Model<DisputeDocument>,
    private readonly ordersService: OrdersService,
  ) {}

  async create(customerId: string, dto: CreateDisputeDto): Promise<DisputeDocument> {
    if (!Types.ObjectId.isValid(dto.orderId)) {
      throw new BadRequestException('Invalid order ID')
    }

    const order = await this.ordersService.getOrderById(dto.orderId)

    if (order.customerId.toString() !== customerId) {
      throw new BadRequestException('You can only dispute your own orders')
    }

    const dispute = await new this.disputeModel({
      orderId:      new Types.ObjectId(dto.orderId),
      customerId:   new Types.ObjectId(customerId),
      restaurantId: order.restaurantId,
      riderId:      order.riderId ?? null,
      type:         dto.type,
      description:  dto.description,
      status:       DisputeStatus.OPEN,
      resolution:   null,
      resolvedBy:   null,
      resolvedAt:   null,
    }).save()

    return dispute
  }

  async listForCustomer(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: DisputeDocument[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }> {
    const skip = (page - 1) * limit
    const filter = { customerId: new Types.ObjectId(customerId) }

    const [data, total] = await Promise.all([
      this.disputeModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.disputeModel.countDocuments(filter),
    ])

    return {
      data: data as unknown as DisputeDocument[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async listForAdmin(
    status: DisputeStatus | undefined,
    page: number,
    limit: number,
  ): Promise<{
    data: DisputeDocument[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }> {
    const skip = (page - 1) * limit
    const filter: Record<string, unknown> = {}
    if (status) filter.status = status

    const [data, total] = await Promise.all([
      this.disputeModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.disputeModel.countDocuments(filter),
    ])

    return {
      data: data as unknown as DisputeDocument[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async resolve(
    adminId: string,
    disputeId: string,
    resolution: string,
  ): Promise<DisputeDocument> {
    if (!Types.ObjectId.isValid(disputeId)) {
      throw new NotFoundException('Dispute not found')
    }

    // Guard against double-resolve: only the first admin to click Resolve wins.
    // findOneAndUpdate with { status: OPEN } filter means concurrent second-clicker
    // matches zero docs → we distinguish "not found" from "already resolved" and
    // return the correct error, not silently overwrite the first admin's resolution.
    const dispute = await this.disputeModel.findOneAndUpdate(
      { _id: new Types.ObjectId(disputeId), status: DisputeStatus.OPEN },
      {
        $set: {
          status:     DisputeStatus.RESOLVED,
          resolution,
          resolvedBy: new Types.ObjectId(adminId),
          resolvedAt: new Date(),
        },
      },
      { new: true },
    )

    if (!dispute) {
      // Distinguish missing dispute from already-resolved so the admin UI can
      // show a helpful "this was already resolved by someone else" message.
      const exists = await this.disputeModel.exists({ _id: new Types.ObjectId(disputeId) })
      if (!exists) throw new NotFoundException('Dispute not found')
      throw new ConflictException('This dispute has already been resolved by another admin')
    }

    return dispute
  }
}
