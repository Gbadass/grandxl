import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import webPush, { type PushSubscription } from 'web-push'

export interface WebPushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
}

@Injectable()
export class WebPushProvider implements OnModuleInit {
  private readonly logger = new Logger(WebPushProvider.name)
  private enabled = false

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const publicKey  = this.config.get<string>('VAPID_PUBLIC_KEY')
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY')
    const subject    = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@grandxl.com'

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not configured — web push disabled. ' +
        'Run: npx web-push generate-vapid-keys and add to .env',
      )
      return
    }

    webPush.setVapidDetails(subject, publicKey, privateKey)
    this.enabled = true
    this.logger.log('Web Push (VAPID) ready')
  }

  async send(subscription: PushSubscription, payload: WebPushPayload): Promise<boolean> {
    if (!this.enabled) return false
    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload))
      return true
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 410 || status === 404) {
        // Subscription expired or unregistered — caller should remove it
        return false
      }
      this.logger.warn(`Web push send failed: ${String(err)}`)
      return false
    }
  }

  async sendToMany(
    subscriptions: PushSubscription[],
    payload: WebPushPayload,
  ): Promise<{ valid: PushSubscription[]; expired: PushSubscription[] }> {
    const valid: PushSubscription[]   = []
    const expired: PushSubscription[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const ok = await this.send(sub, payload)
        if (ok) valid.push(sub)
        else expired.push(sub)
      }),
    )

    return { valid, expired }
  }
}
