import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type SurgeRuleDocumentType = HydratedDocument<SurgeRuleDocument>

// Time-based surge rules. Days-of-week + minutes-since-midnight (local time).
// A rule matches when: today is in daysOfWeek AND current minute is inside window.
// If multiple rules match, the highest multiplier wins.
@Schema({ collection: 'surge_rules', timestamps: true })
export class SurgeRuleDocument {
  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true, min: 1.0, max: 5.0 })
  multiplier!: number

  // 0=Sunday..6=Saturday (local time)
  @Prop({ type: [Number], required: true })
  daysOfWeek!: number[]

  // Minutes since midnight, e.g. 18:00 = 1080
  @Prop({ required: true, min: 0, max: 1440 })
  startMinutes!: number

  @Prop({ required: true, min: 0, max: 1440 })
  endMinutes!: number

  @Prop({ default: true })
  isActive!: boolean
}

export const SurgeRuleSchema = SchemaFactory.createForClass(SurgeRuleDocument)

SurgeRuleSchema.index({ isActive: 1 })
