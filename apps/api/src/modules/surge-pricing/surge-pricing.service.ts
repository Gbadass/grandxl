import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { SurgeRuleDocument } from './schemas/surge-rule.schema'
import { CreateSurgeRuleDto, UpdateSurgeRuleDto } from './dto/surge-rule.dto'

@Injectable()
export class SurgePricingService {
  constructor(
    @InjectModel(SurgeRuleDocument.name)
    private readonly ruleModel: Model<SurgeRuleDocument>,
  ) {}

  async listAll(): Promise<SurgeRuleDocument[]> {
    return this.ruleModel.find().sort({ multiplier: -1, name: 1 }).lean() as unknown as SurgeRuleDocument[]
  }

  async create(dto: CreateSurgeRuleDto): Promise<SurgeRuleDocument> {
    return this.ruleModel.create({ ...dto, isActive: dto.isActive ?? true })
  }

  async update(id: string, dto: UpdateSurgeRuleDto): Promise<SurgeRuleDocument> {
    const rule = await this.ruleModel.findByIdAndUpdate(id, { $set: dto }, { new: true })
    if (!rule) throw new NotFoundException('Surge rule not found')
    return rule
  }

  async delete(id: string): Promise<void> {
    const rule = await this.ruleModel.findByIdAndDelete(id)
    if (!rule) throw new NotFoundException('Surge rule not found')
  }

  // Returns the highest active multiplier matching `at`. If nothing matches, 1.0.
  // Uses Africa/Lagos local time explicitly via Intl — does not depend on TZ env.
  async getMultiplierAt(at: Date = new Date()): Promise<number> {
    // Reinterpret `at` in Africa/Lagos so getDay()/getHours() return local values.
    const lagosDate = new Date(at.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
    const day    = lagosDate.getDay()
    const minute = lagosDate.getHours() * 60 + lagosDate.getMinutes()

    const rules = await this.ruleModel.find({
      isActive:     true,
      daysOfWeek:   day,
      startMinutes: { $lte: minute },
      endMinutes:   { $gte: minute },
    }).lean() as Array<{ multiplier: number }>

    if (rules.length === 0) return 1.0
    return Math.max(...rules.map((r) => r.multiplier))
  }
}
