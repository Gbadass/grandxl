import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

// Types of critical side-effects that must not be dropped.
// A new type = a new executor case in SideEffectsService.execute().
export enum SideEffectType {
  DISPATCH_ORDER  = 'dispatch_order',   // enqueue rider-dispatch BullMQ job
  WALLET_REFUND   = 'wallet_refund',    // credit customer wallet
  RELEASE_RIDER   = 'release_rider',    // set rider isAvailable=true
}

export enum SideEffectStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
  DEAD      = 'dead',      // exceeded max attempts — admin must intervene
}

// Persistent durable retry queue. Independent of Redis — lives in MongoDB.
// A sweeper (setInterval in SideEffectsService) periodically executes pending
// effects. If Redis is down (blocking BullMQ enqueue), we use this. If wallet
// credit fails (Mongo blip), we use this. If rider release fails, same.
//
// The invariant: any operation that would silently lose money/data if it fails
// must EITHER succeed inline OR land here as a pending side-effect. Never both,
// never neither.
@Schema({ timestamps: true, collection: 'pending_side_effects' })
export class PendingSideEffectDocument extends Document {
  @Prop({ required: true, enum: Object.values(SideEffectType), index: true })
  type!: SideEffectType

  // Type-specific opaque payload. Each executor knows its own shape.
  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>

  @Prop({
    required: true,
    enum: Object.values(SideEffectStatus),
    default: SideEffectStatus.PENDING,
    index: true,
  })
  status!: SideEffectStatus

  @Prop({ type: Number, default: 0 })
  attempts!: number

  @Prop({ type: Date, default: null })
  lastAttemptAt!: Date | null

  @Prop({ type: String, default: null })
  lastError!: string | null

  // Idempotency key — prevents duplicate enqueue of the same logical action.
  // e.g., "dispatch:<orderId>" — writing twice for the same order is a no-op.
  @Prop({ type: String, required: true, unique: true, index: true })
  idempotencyKey!: string

  createdAt!: Date
  updatedAt!: Date
}

export const PendingSideEffectSchema = SchemaFactory.createForClass(PendingSideEffectDocument)

// Sweeper query: pending + not attempted recently (basic exponential backoff via `lastAttemptAt`)
PendingSideEffectSchema.index({ status: 1, lastAttemptAt: 1 })
