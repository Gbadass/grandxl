import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ChatMessageDocument = ChatMessage & Document

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'OrderDocument', required: true, index: true })
  orderId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, required: true })
  senderId!: Types.ObjectId

  @Prop({ type: String, enum: ['customer', 'rider'], required: true })
  senderRole!: 'customer' | 'rider'

  @Prop({ required: true, maxlength: 500 })
  text!: string

  @Prop({ default: false })
  isRead!: boolean

  @Prop({ type: Date, default: null })
  readAt!: Date | null

  // Soft-delete — admin moderation. Message text replaced with placeholder in API response.
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage)

// Compound index: list messages for an order newest-first; also used for unread count
ChatMessageSchema.index({ orderId: 1, createdAt: -1 })
// Fast lookup for marking messages read (filter by sender ≠ reader)
ChatMessageSchema.index({ orderId: 1, senderId: 1, readAt: 1 })
