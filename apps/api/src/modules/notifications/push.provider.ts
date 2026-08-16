import { Injectable, Logger } from '@nestjs/common'
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
}

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name)
  private readonly expo = new Expo()

  async sendPushNotification(
    expoPushToken: string,
    payload: PushPayload,
  ): Promise<void> {
    if (!Expo.isExpoPushToken(expoPushToken)) {
      const preview = String(expoPushToken).slice(0, 20)
      this.logger.warn(`Invalid Expo push token "${preview}…" — skipping`)
      return
    }

    const message: ExpoPushMessage = {
      to: expoPushToken,
      sound: payload.sound ?? 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
    }

    await this.sendBatch([message])
  }

  async sendBulkPushNotifications(
    tokens: string[],
    payload: PushPayload,
  ): Promise<void> {
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t))
    if (validTokens.length === 0) return

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: payload.sound ?? 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
    }))

    await this.sendBatch(messages)
  }

  private async sendBatch(messages: ExpoPushMessage[]): Promise<void> {
    const chunks = this.expo.chunkPushNotifications(messages)

    for (const chunk of chunks) {
      let tickets: ExpoPushTicket[]
      try {
        tickets = await this.expo.sendPushNotificationsAsync(chunk)
      } catch (err) {
        this.logger.error(`Expo sendPushNotificationsAsync failed: ${String(err)}`)
        continue
      }

      // Surface per-ticket errors — most common: DeviceNotRegistered, InvalidCredentials.
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          const code = ticket.details?.error ?? 'unknown'
          this.logger.warn(`Expo push ticket error: code=${code} message="${ticket.message}"`)
        } else {
          this.logger.log(`✓ Expo accepted ticket id=${ticket.id}`)
        }
      }
    }
  }
}
