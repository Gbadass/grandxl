import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ContentPageDocument, ContentPageSchema } from './schemas/content-page.schema'
import { ContentPagesService } from './content-pages.service'
import { AdminContentPagesController, PublicContentPagesController } from './content-pages.controller'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ContentPageDocument.name, schema: ContentPageSchema }]),
  ],
  controllers: [PublicContentPagesController, AdminContentPagesController],
  providers: [ContentPagesService],
  exports: [ContentPagesService],
})
export class ContentPagesModule {}
