import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import { Model, Types } from 'mongoose'
import type { Queue } from 'bullmq'
import { UserDocument } from '../users/schemas/user.schema'
import {
  CampaignAudience,
  CampaignDocument,
  CampaignStatus,
} from './schemas/campaign.schema'
import { CreateCampaignDto } from './dto/campaign.dto'
import { CAMPAIGN_QUEUE } from './constants'
import { UserRole } from '@grandxl/types'

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name)

  constructor(
    @InjectModel(CampaignDocument.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel('UserDocument')
    private readonly userModel: Model<UserDocument>,
    @InjectQueue(CAMPAIGN_QUEUE)
    private readonly queue: Queue,
  ) {}

  async listAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.campaignModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.campaignModel.countDocuments(),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async create(adminId: string, dto: CreateCampaignDto): Promise<CampaignDocument> {
    const target = await this.countAudience(dto.audience)
    return this.campaignModel.create({
      ...dto,
      createdBy:   new Types.ObjectId(adminId),
      status:      CampaignStatus.DRAFT,
      targetCount: target,
    })
  }

  async send(id: string): Promise<CampaignDocument> {
    const campaign = await this.campaignModel.findById(id)
    if (!campaign) throw new NotFoundException('Campaign not found')
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException(`Campaign is already ${campaign.status}`)
    }

    campaign.status    = CampaignStatus.QUEUED
    campaign.startedAt = new Date()
    await campaign.save()

    // Enqueue for background processing — a worker pulls users in pages, sends
    // via Expo, and updates sentCount / failedCount. Keeps HTTP responsive even
    // for 10k+ user audiences.
    await this.queue.add('send', { campaignId: campaign._id.toString() })

    return campaign
  }

  // Worker calls this to iterate the audience.
  // We stream in pages of 500 to bound memory even at large scale.
  async *iterateAudience(audience: CampaignAudience): AsyncGenerator<UserDocument[]> {
    const query = this.buildAudienceQuery(audience)
    const cursor = this.userModel
      .find(query, { _id: 1, expoPushToken: 1 })
      .lean()
      .cursor({ batchSize: 500 })

    let batch: UserDocument[] = []
    for await (const doc of cursor as AsyncIterable<UserDocument>) {
      batch.push(doc)
      if (batch.length >= 500) {
        yield batch
        batch = []
      }
    }
    if (batch.length > 0) yield batch
  }

  async recordSent(id: string, delta: number, failed: number): Promise<void> {
    await this.campaignModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $inc: { sentCount: delta, failedCount: failed } },
    )
  }

  async markCompleted(id: string): Promise<void> {
    await this.campaignModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { status: CampaignStatus.COMPLETED, completedAt: new Date() } },
    )
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.campaignModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { status: CampaignStatus.FAILED, failureReason: reason, completedAt: new Date() } },
    )
  }

  async markSending(id: string): Promise<void> {
    await this.campaignModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { status: CampaignStatus.SENDING } },
    )
  }

  async getForWorker(id: string): Promise<CampaignDocument | null> {
    return this.campaignModel.findById(id).lean() as unknown as CampaignDocument | null
  }

  // ── Audience helpers ────────────────────────────────────────────────

  private buildAudienceQuery(audience: CampaignAudience): Record<string, unknown> {
    const base: Record<string, unknown> = {
      isActive:      true,
      deletedAt:     null,
      expoPushToken: { $ne: null },
    }

    switch (audience) {
      case CampaignAudience.ALL_CUSTOMERS:
        return { ...base, roles: UserRole.CUSTOMER }
      case CampaignAudience.ALL_RIDERS:
        return { ...base, roles: UserRole.RIDER }
      case CampaignAudience.ALL_RESTAURANT_OWNERS:
        return { ...base, roles: UserRole.RESTAURANT_OWNER }
      case CampaignAudience.INACTIVE_30D:
        return {
          ...base,
          $or: [
            { lastLoginAt: null },
            { lastLoginAt: { $lt: new Date(Date.now() - 30 * 86_400_000) } },
          ],
        }
    }
  }

  private async countAudience(audience: CampaignAudience): Promise<number> {
    return this.userModel.countDocuments(this.buildAudienceQuery(audience))
  }
}
