import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { NotificationType } from '@grandxl/types'

@Schema({ timestamps: true, collection: 'notifications' })
export class NotificationDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  userId!: Types.ObjectId

  @Prop({ required: true, enum: Object.values(NotificationType) })
  type!: NotificationType

  @Prop({ required: true })
  title!: string

  @Prop({ required: true })
  body!: string

  @Prop({ type: Object, default: null })
  data!: Record<string, unknown> | null // e.g. { orderId, status }

  @Prop({ default: false })
  isRead!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export const NotificationSchema = SchemaFactory.createForClass(NotificationDocument)

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })
