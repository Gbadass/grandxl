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

  // Returns true if Expo reported DeviceNotRegistered — caller should prune the token.
  async sendPushNotification(
    expoPushToken: string,
    payload: PushPayload,
  ): Promise<{ dead: boolean }> {
    if (!Expo.isExpoPushToken(expoPushToken)) {
      const preview = String(expoPushToken).slice(0, 20)
      this.logger.warn(`Invalid Expo push token "${preview}…" — skipping`)
      return { dead: false }
    }

    const message: ExpoPushMessage = {
      to: expoPushToken,
      sound: payload.sound ?? 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
    }

    const deadTokens = await this.sendBatch([message])
    return { dead: deadTokens.includes(expoPushToken) }
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

  // Returns the list of tokens that Expo flagged as DeviceNotRegistered so callers
  // can prune them. All other errors are logged but not surfaced.
  private async sendBatch(messages: ExpoPushMessage[]): Promise<string[]> {
    const chunks = this.expo.chunkPushNotifications(messages)
    const deadTokens: string[] = []

    for (const chunk of chunks) {
      let tickets: ExpoPushTicket[]
      try {
        tickets = await this.expo.sendPushNotificationsAsync(chunk)
      } catch (err) {
        this.logger.error(`Expo sendPushNotificationsAsync failed: ${String(err)}`)
        continue
      }

      // Surface per-ticket errors — most common: DeviceNotRegistered, InvalidCredentials.
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i]
        if (ticket.status === 'error') {
          const code = ticket.details?.error ?? 'unknown'
          this.logger.warn(`Expo push ticket error: code=${code} message="${ticket.message}"`)
          if (code === 'DeviceNotRegistered') {
            const token = chunk[i]?.to
            if (typeof token === 'string') deadTokens.push(token)
          }
        } else {
          this.logger.log(`✓ Expo accepted ticket id=${ticket.id}`)
        }
      }
    }

    return deadTokens
  }
}
