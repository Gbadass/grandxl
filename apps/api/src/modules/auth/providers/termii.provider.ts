import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class TermiiProvider {
  private readonly logger = new Logger(TermiiProvider.name)

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, otp: string): Promise<void> {
    return this.send(
      phone,
      `Your GrandXL verification code is ${otp}. Valid for 10 minutes. Do not share this code with anyone.`,
      /* throwOnFailure */ true,
    )
  }

  // Transactional SMS — order updates, payout confirmations, etc.
  // Fire-and-forget by default: an SMS provider outage must never break the
  // underlying operation (e.g. order status transition). Set throwOnFailure=true
  // only when the caller wants to surface the error (like OTP send).
  async sendTransactional(phone: string, message: string): Promise<void> {
    return this.send(phone, message, /* throwOnFailure */ false)
  }

  private async send(phone: string, message: string, throwOnFailure: boolean): Promise<void> {
    const apiKey   = this.config.getOrThrow<string>('TERMII_API_KEY')
    const senderId = this.config.get<string>('TERMII_SENDER_ID', 'GrandXL')
    const baseUrl  = this.config.get<string>(
      'TERMII_BASE_URL',
      'https://v3.api.termii.com',
    )

    // Try DND channel first (reaches DND-registered Nigerian numbers),
    // fall back to generic if DND fails
    for (const channel of ['dnd', 'generic'] as const) {
      try {
        const res = await axios.post<{ code?: string; message?: string }>(
          `${baseUrl}/api/sms/send`,
          {
            to:      phone,
            from:    senderId,
            sms:     message,
            type:    'plain',
            channel,
            api_key: apiKey,
          },
        )
        // Termii returns HTTP 200 even on failure — check the body
        if (res.data?.code === 'ok' || !res.data?.code) {
          return // success
        }
        this.logger.warn(`Termii ${channel} channel rejected`, res.data)
      } catch (error) {
        this.logger.warn(`Termii ${channel} channel error`, error)
      }
    }

    this.logger.error('Termii: all channels failed', { phone })
    if (throwOnFailure) {
      throw new ServiceUnavailableException('Failed to send SMS. Please try again.')
    }
  }
}
