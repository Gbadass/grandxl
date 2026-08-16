import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type ContentPageDocumentType = HydratedDocument<ContentPageDocument>

// Simple static content — Markdown body served by slug (`/content/faq`,
// `/content/terms`, etc). Version-tracked via `updatedAt` on the doc.
@Schema({ collection: 'content_pages', timestamps: true })
export class ContentPageDocument {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string

  @Prop({ required: true, trim: true })
  title!: string

  @Prop({ required: true })
  body!: string  // Markdown

  @Prop({ default: true })
  isPublished!: boolean

  @Prop({ type: Types.ObjectId, ref: 'UserDocument' })
  lastEditedBy?: Types.ObjectId
}

export const ContentPageSchema = SchemaFactory.createForClass(ContentPageDocument)
