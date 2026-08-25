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
      const msg =
        'VAPID keys not configured — web push DISABLED. ' +
        'Riders will NOT receive job notifications in background. ' +
        'Run: npx web-push generate-vapid-keys and add VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to .env'
      if (this.config.get('NODE_ENV') === 'production') {
        this.logger.error(msg)
      } else {
        this.logger.warn(msg)
      }
      return
    }

    webPush.setVapidDetails(subject, publicKey, privateKey)
    this.enabled = true
    this.logger.log('Web Push (VAPID) ready')
  }

  async send(subscription: PushSubscription, payload: WebPushPayload): Promise<'ok' | 'expired' | 'transient'> {
    if (!this.enabled) return 'transient'
    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload))
      return 'ok'
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 410 || status === 404) {
        // Subscription expired or unregistered — safe to remove from DB
        return 'expired'
      }
      this.logger.warn(`Web push send failed (transient): ${String(err)}`)
      // Any other error (5xx, network timeout) is transient — keep subscription
      return 'transient'
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
        const result = await this.send(sub, payload)
        if (result === 'ok')      valid.push(sub)
        else if (result === 'expired') expired.push(sub)
        // 'transient' — keep the subscription, skip both lists
      }),
    )

    return { valid, expired }
  }
}
