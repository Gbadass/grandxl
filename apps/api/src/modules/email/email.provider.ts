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

  async sendRestaurantApproved(
    email: string,
    firstName: string,
    restaurantName: string,
  ): Promise<void> {
    const dashboardUrl = `${this.config.get<string>('ADMIN_URL', 'http://localhost:3000')}/restaurant/dashboard`
    await this.send({
      to: email,
      subject: `🎉 ${restaurantName} is now live on GrandXL!`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:8px">Congratulations, ${firstName}! 🎉</h2>
          <p style="color:#555;line-height:1.55">
            <strong>${restaurantName}</strong> has been approved and is now live on GrandXL.
            Customers can discover and order from your restaurant right now.
          </p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 18px;margin:18px 0">
            <p style="margin:0;color:#166534;font-weight:600">You're ready to go — here's what to do next:</p>
            <ul style="margin:8px 0 0;padding-left:18px;color:#14532d;line-height:1.6">
              <li>Make sure your menu is complete and up to date</li>
              <li>Set your opening hours in Settings</li>
              <li>Go online to start receiving orders</li>
            </ul>
          </div>

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

  async sendRestaurantRejected(
    email: string,
    firstName: string,
    restaurantName: string,
    reason: string,
  ): Promise<void> {
    const supportEmail = 'partners@grandxl.com'
    await this.send({
      to: email,
      subject: `Update on your GrandXL application — ${restaurantName}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:8px">Hi ${firstName},</h2>
          <p style="color:#555;line-height:1.55">
            Thank you for applying to join GrandXL. After reviewing your application for
            <strong>${restaurantName}</strong>, we're unable to approve it at this time.
          </p>

          <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:16px 18px;margin:18px 0">
            <p style="margin:0;color:#9f1239;font-weight:600">Reason:</p>
            <p style="margin:8px 0 0;color:#881337;line-height:1.55">${reason}</p>
          </div>

          <p style="color:#555;line-height:1.55">
            If you believe this is an error or you'd like to reapply after addressing the issue,
            please reply to this email and our team will assist you.
          </p>

          <a href="mailto:${supportEmail}"
             style="background:#111;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;display:inline-block;margin:8px 0;font-weight:600">
            Contact Support
          </a>

          <p style="margin-top:24px;color:#aaa;font-size:12px">— The GrandXL Team</p>
        </div>
      `,
    })
  }

  async sendOwnerWelcomeCredentials(
    email: string,
    firstName: string,
    restaurantName: string,
    phone: string,
    tempPassword: string,
  ): Promise<void> {
    const adminUrl = this.config.get<string>('ADMIN_URL', 'http://localhost:3000')
    const loginUrl = `${adminUrl}/auth/login`
    await this.send({
      to: email,
      subject: `Welcome to GrandXL — your restaurant account is ready`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:8px">Hi ${firstName},</h2>
          <p style="color:#555;line-height:1.55">
            A GrandXL account has been created for you as the owner of
            <strong>${restaurantName}</strong>. Your restaurant is already live and approved.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:20px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Your login details</p>
            <p style="margin:4px 0;font-size:15px"><strong>Phone:</strong> ${phone}</p>
            <p style="margin:4px 0;font-size:15px"><strong>Temp password:</strong> <span style="font-family:monospace;background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:2px 8px">${tempPassword}</span></p>
          </div>
          <a href="${loginUrl}"
             style="background:#f97316;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;display:inline-block;margin:0 0 16px;font-weight:600">
            Login to your dashboard
          </a>
          <p style="color:#ef4444;font-size:13px;font-weight:600">⚠ Please change your password immediately after logging in.</p>
          <p style="color:#888;font-size:13px;margin-top:24px">Questions? Reply to this email or WhatsApp us at our partner support line.</p>
          <p style="margin-top:24px;color:#aaa;font-size:12px">— The GrandXL Team</p>
        </div>
      `,
    })
  }

  async sendEmailChangeVerification(newEmail: string, firstName: string, token: string): Promise<void> {
    const clientUrl = this.config.get<string>('WEB_URL', 'http://localhost:5173')
    const verifyUrl = `${clientUrl}/verify-email-change?token=${token}`
    await this.send({
      to: newEmail,
      subject: 'Confirm your new GrandXL email',
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:8px">Hi ${firstName},</h2>
          <p style="color:#555;line-height:1.55">You requested to change your GrandXL account email to this address.</p>
          <p style="color:#555;line-height:1.55">Click the button below to confirm. Link expires in <strong>15 minutes</strong>.</p>
          <a href="${verifyUrl}"
             style="background:#f97316;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;display:inline-block;margin:16px 0;font-weight:600">
            Confirm new email
          </a>
          <p style="color:#888;font-size:13px;margin-top:24px">If you didn't request this, ignore this email — your account email will not change.</p>
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
