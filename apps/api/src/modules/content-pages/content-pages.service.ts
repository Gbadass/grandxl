import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { ContentPageDocument } from './schemas/content-page.schema'
import { UpsertContentPageDto } from './dto/content-page.dto'

@Injectable()
export class ContentPagesService {
  constructor(
    @InjectModel(ContentPageDocument.name)
    private readonly pageModel: Model<ContentPageDocument>,
  ) {}

  async findPublicBySlug(slug: string): Promise<ContentPageDocument> {
    const page = await this.pageModel.findOne({ slug: slug.toLowerCase(), isPublished: true }).lean()
    if (!page) throw new NotFoundException('Page not found')
    return page as unknown as ContentPageDocument
  }

  async listAll(): Promise<ContentPageDocument[]> {
    return this.pageModel.find().sort({ slug: 1 }).lean() as unknown as ContentPageDocument[]
  }

  // Upsert-by-slug — makes seeding + admin edits simple.
  async upsert(adminId: string, dto: UpsertContentPageDto): Promise<ContentPageDocument> {
    const updated = await this.pageModel.findOneAndUpdate(
      { slug: dto.slug.toLowerCase() },
      {
        $set: {
          slug:         dto.slug.toLowerCase(),
          title:        dto.title,
          body:         dto.body,
          isPublished:  dto.isPublished ?? true,
          lastEditedBy: new Types.ObjectId(adminId),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean()
    return updated as unknown as ContentPageDocument
  }

  async delete(slug: string): Promise<void> {
    const result = await this.pageModel.findOneAndDelete({ slug: slug.toLowerCase() })
    if (!result) throw new NotFoundException('Page not found')
  }
}
