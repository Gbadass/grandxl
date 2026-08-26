import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

// One document per online session. Opened when a rider toggles online,
// closed (endAt set) when they toggle offline. Sum(endAt - startAt) over
// a period = their total online time — the denominator for utilization.
@Schema({ timestamps: true, collection: 'rider_online_sessions' })
export class RiderOnlineSessionDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'RiderDocument', required: true, index: true })
  riderId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true, index: true })
  userId!: Types.ObjectId

  @Prop({ required: true, index: true })
  startAt!: Date

  @Prop({ type: Date, default: null, index: true })
  endAt!: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export const RiderOnlineSessionSchema = SchemaFactory.createForClass(RiderOnlineSessionDocument)

// Fast lookup: does this rider have a currently-open session?
RiderOnlineSessionSchema.index({ riderId: 1, endAt: 1 })
// Aggregation over a period, per rider
RiderOnlineSessionSchema.index({ riderId: 1, startAt: -1 })
