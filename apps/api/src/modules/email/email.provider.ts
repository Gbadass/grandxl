import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name)

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(email: string, firstName: string, resetToken: string): Promise<void> {
    // Password reset is currently only requested from the admin/partner portal.
    const adminUrl = this.config.get<string>('ADMIN_URL', 'http://localhost:3000')
    const resetUrl = `${adminUrl}/auth/reset-password?token=${resetToken}`
    await this.send({
      to: email,
      subject: 'Reset your GrandXL password',
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:8px">Hi ${firstName},</h2>
          <p style="color:#555;line-height:1.55">We received a request to reset your GrandXL password.</p>
          <p style="color:#555;line-height:1.55">Click the button below to choose a new one. This link expires in <strong>15 minutes</strong>.</p>
          <a href="${resetUrl}"
             style="background:#f97316;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;display:inline-block;margin:16px 0;font-weight:600">
            Reset Password
          </a>
          <p style="color:#888;font-size:13px;margin-top:24px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          <p style="margin-top:24px;color:#aaa;font-size:12px">— The GrandXL Team</p>
        </div>
      `,
    })
  }

  async sendRestaurantRegistrationConfirmation(
    email: string,
    firstName: string,
    restaurantName: string,
  ): Promise<void> {
    const clientUrl = this.config.get<string>('ADMIN_URL', 'http://localhost:3001')
    const dashboardUrl = `${clientUrl}/restaurant/dashboard`
    await this.send({
      to: email,
      subject: `Welcome to GrandXL — ${restaurantName} is under review`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:8px">Welcome, ${firstName} 👋</h2>
          <p style="color:#555;line-height:1.55">
            Thanks for registering <strong>${restaurantName}</strong> on GrandXL.
            We've received your application and our team will review it within
            <strong>24 hours</strong>.
          </p>

          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 18px;margin:18px 0">
            <p style="margin:0;color:#9a3412;font-weight:600">What happens next?</p>
            <ul style="margin:8px 0 0;padding-left:18px;color:#7c2d12;line-height:1.6">
              <li>Our team verifies your business details</li>
              <li>You'll get an email once you're approved</li>
              <li>Then you can publish your menu and start receiving orders</li>
            </ul>
          </div>

          <p style="color:#555;line-height:1.55">
            In the meantime, you can sign in to your dashboard and start preparing your menu.
          </p>

          <a href="${dashboardUrl}"
             style="background:#f97316;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;display:inline-block;margin:8px 0;font-weight:600">
            Open Dashboard
          </a>

          <p style="margin-top:24px;color:#888;font-size:13px">
            Need help? Reply to this email or reach us at
            <a href="mailto:partners@grandxl.com" style="color:#f97316">partners@grandxl.com</a>.
          </p>
          <p style="margin-top:24px;color:#aaa;font-size:12px">— The GrandXL Team</p>
        </div>
      `,
    })
  }

  async sendRestaurantInfoRequest(
    email: string,
    firstName: string,
    restaurantName: string,
    message: string,
  ): Promise<void> {
    const clientUrl = this.config.get<string>('ADMIN_URL', 'http://localhost:3001')
    const dashboardUrl = `${clientUrl}/restaurant/settings`
    // Escape user-supplied message — it's authored by admin, but treat as untrusted.
    const safeMessage = message
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/\n/g, '<br />')

    await this.send({
      to: email,
      subject: `Action needed: more info on ${restaurantName}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:8px">Hi ${firstName},</h2>
          <p style="color:#555;line-height:1.55">
            Our team has reviewed your application for <strong>${restaurantName}</strong>
            and needs a bit more information before we can approve it.
          </p>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 18px;margin:18px 0">
            <p style="margin:0 0 8px;color:#92400e;font-weight:600">From our review team</p>
            <p style="margin:0;color:#78350f;line-height:1.6">${safeMessage}</p>
          </div>

          <p style="color:#555;line-height:1.55">
            Please update your restaurant details in the dashboard and we'll re-review your application.
          </p>

          <a href="${dashboardUrl}"
             style="background:#f97316;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;display:inline-block;margin:8px 0;font-weight:600">
            Update Details
          </a>

          <p style="margin-top:24px;color:#888;font-size:13px">
            Questions? Reply to this email or reach us at
            <a href="mailto:partners@grandxl.com" style="color:#f97316">partners@grandxl.com</a>.
          </p>
          <p style="margin-top:24px;color:#aaa;font-size:12px">— The GrandXL Team</p>
        </div>
      `,
    })
  }

  async sendAdminSecurityAlert(email: string, lockedUntil: Date): Promise<void> {
    await this.send({
      to: email,
      subject: 'GrandXL Admin: Account Temporarily Locked',
      html: `
        <h2>Security Alert</h2>
        <p>Your GrandXL admin account has been temporarily locked due to 5 consecutive failed login attempts.</p>
        <p>Your account will be automatically unlocked at <strong>${lockedUntil.toUTCString()}</strong>.</p>
        <p>If this was not you, please contact security immediately at security@grandxl.com.</p>
        <p>— GrandXL Security Team</p>
      `,
    })
  }

  private async send(options: {
    to: string
    subject: string
    html: string
  }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY', '')
    const fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'noreply@grandxl.com')
    const fromName = this.config.get<string>('RESEND_FROM_NAME', 'GrandXL')

    if (!apiKey) {
      this.logger.warn(`Email not sent (no RESEND_API_KEY): ${options.subject} → ${options.to}`)
      return
    }

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: `${fromName} <${fromEmail}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
        },
        { headers: { Authorization: `Bearer ${apiKey}` } },
      )
    } catch (error) {
      // Log but don't throw — email failure should not break the auth flow
      this.logger.error('Resend email failed', { to: options.to, subject: options.subject, error })
    }
  }
}
