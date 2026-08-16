import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BullModule } from '@nestjs/bullmq'
import { CampaignDocument, CampaignSchema } from './schemas/campaign.schema'
import { UserDocument, UserSchema } from '../users/schemas/user.schema'
import { CampaignsService } from './campaigns.service'
import { CampaignsController } from './campaigns.controller'
import { CampaignProcessor } from './processors/campaign.processor'
import { CAMPAIGN_QUEUE } from './constants'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CampaignDocument.name, schema: CampaignSchema },
      { name: UserDocument.name,     schema: UserSchema },
    ]),
    BullModule.registerQueue({
      name: CAMPAIGN_QUEUE,
      defaultJobOptions: { attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
    }),
    NotificationsModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignProcessor],
  exports: [CampaignsService],
})
export class CampaignsModule {}
