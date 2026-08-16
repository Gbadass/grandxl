import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BannerDocument } from './schemas/banner.schema'
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto'

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(BannerDocument.name)
    private readonly bannerModel: Model<BannerDocument>,
  ) {}

  // Public list — only banners visible right now.
  async listActive(): Promise<BannerDocument[]> {
    const now = new Date()
    return this.bannerModel
      .find({ isActive: true, startDate: { $lte: now }, endDate: { $gte: now } })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean() as unknown as BannerDocument[]
  }

  // Admin list — everything, sorted newest first.
  async listAll(): Promise<BannerDocument[]> {
    return this.bannerModel
      .find()
      .sort({ createdAt: -1 })
      .lean() as unknown as BannerDocument[]
  }

  async create(dto: CreateBannerDto): Promise<BannerDocument> {
    return this.bannerModel.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate:   new Date(dto.endDate),
      isActive:  dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    })
  }

  async update(id: string, dto: UpdateBannerDto): Promise<BannerDocument> {
    const updates: Record<string, unknown> = { ...dto }
    if (dto.startDate) updates.startDate = new Date(dto.startDate)
    if (dto.endDate)   updates.endDate   = new Date(dto.endDate)
    const banner = await this.bannerModel.findByIdAndUpdate(id, { $set: updates }, { new: true })
    if (!banner) throw new NotFoundException('Banner not found')
    return banner
  }

  async delete(id: string): Promise<void> {
    const result = await this.bannerModel.findByIdAndDelete(id)
    if (!result) throw new NotFoundException('Banner not found')
  }
}
