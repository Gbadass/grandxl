import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { CAMPAIGN_QUEUE } from '../constants'
import { CampaignsService } from '../campaigns.service'
import { PushProvider } from '../../notifications/push.provider'

export interface CampaignJobData {
  campaignId: string
}

// Batches user tokens and sends via Expo. Expo's push API accepts up to
// 100 messages per call, so we chunk that way — well under the 500-per-batch
// stream from the service.
@Processor(CAMPAIGN_QUEUE)
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name)

  constructor(
    private readonly campaigns: CampaignsService,
    private readonly push:      PushProvider,
  ) {
    super()
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId } = job.data
    const campaign = await this.campaigns.getForWorker(campaignId)
    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found — skipping`)
      return
    }

    await this.campaigns.markSending(campaignId)

    try {
      for await (const users of this.campaigns.iterateAudience(campaign.audience)) {
        // Chunk into groups of 100 per Expo API constraints.
        for (let i = 0; i < users.length; i += 100) {
          const chunk = users.slice(i, i + 100)
          let sent = 0
          let failed = 0
          await Promise.all(chunk.map(async (u) => {
            if (!u.expoPushToken) return
            try {
              await this.push.sendPushNotification(u.expoPushToken, {
                title: campaign.title,
                body:  campaign.body,
                data:  campaign.linkUrl ? { url: campaign.linkUrl, campaignId } : { campaignId },
              })
              sent++
            } catch {
              failed++
            }
          }))
          await this.campaigns.recordSent(campaignId, sent, failed)
        }
      }
      await this.campaigns.markCompleted(campaignId)
    } catch (err) {
      this.logger.error(`Campaign ${campaignId} failed: ${(err as Error).message}`)
      await this.campaigns.markFailed(campaignId, (err as Error).message)
      throw err
    }
  }
}
