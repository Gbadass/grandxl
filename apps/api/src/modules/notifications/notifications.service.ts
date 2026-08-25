import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { NotificationDocument } from './schemas/notification.schema'
import { PushProvider } from './push.provider'
import { WebPushProvider } from './web-push.provider'
import { UsersService } from '../users/users.service'
import { TermiiProvider } from '../auth/providers/termii.provider'
import { TrackingGateway } from '../tracking/tracking.gateway'
import { NotificationType, OrderStatus, UserRole } from '@grandxl/types'

// Which statuses warrant an SMS to the customer. Non-transitional states are
// omitted so we don't spam. Also kept short to fit inside a single SMS billed
// unit (160 chars).
const SMS_STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.CONFIRMED]: 'confirmed — the restaurant is preparing it now.',
  [OrderStatus.READY]:     'is ready and a rider is on the way to collect.',
  [OrderStatus.PICKED_UP]: 'is on the way to you. Track it in the app.',
  [OrderStatus.DELIVERED]: 'has been delivered. Enjoy your meal!',
  [OrderStatus.CANCELLED]: 'has been cancelled. Refund (if any) processing.',
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    @InjectModel(NotificationDocument.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly pushProvider:      PushProvider,
    private readonly webPushProvider:   WebPushProvider,
    private readonly usersService:      UsersService,
    private readonly termii:            TermiiProvider,
    private readonly trackingGateway:   TrackingGateway,
  ) {}

  // ── Core: save record + send push ───────────────────────────────

  async send(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    // Save in-app notification
    await this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      type,
      title,
      body,
      data: data ?? null,
    })

    // Emit real-time socket event so connected clients update instantly
    this.trackingGateway.sendToUser(userId, 'notification:new', { title, body, type })

    // Send push — Expo (mobile) + Web Push (browser) in parallel.
    try {
      const user = await this.usersService.findById(userId)
      if (!user) {
        this.logger.warn(`Push skipped — user ${userId} not found`)
        return
      }

      const pushJobs: Promise<unknown>[] = []

      // Expo push (mobile apps) — prune token if Expo reports DeviceNotRegistered
      if (user.expoPushToken) {
        this.logger.log(`→ expo push user=${userId} title="${title}"`)
        pushJobs.push(
          this.pushProvider.sendPushNotification(user.expoPushToken, { title, body, data })
            .then(({ dead }) => {
              if (dead) {
                this.logger.warn(`Expo token dead for user=${userId} — pruning`)
                void this.usersService.clearExpoPushToken(userId).catch(() => undefined)
              }
            }),
        )
      }

      // Web push (browser PWA)
      const webSubs = user.webPushSubscriptions ?? []
      if (webSubs.length > 0) {
        this.logger.log(`→ web push user=${userId} subs=${webSubs.length} title="${title}"`)
        pushJobs.push(
          this.webPushProvider
            .sendToMany(webSubs, { title, body, icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', data: data as Record<string, unknown> })
            .then(({ expired }) => {
              if (expired.length > 0) {
                void this.usersService
                  .removeExpiredWebPushSubscriptions(userId, expired.map((s) => s.endpoint))
                  .catch(() => undefined)
              }
            }),
        )
      }

      if (pushJobs.length === 0) {
        this.logger.warn(
          `Push skipped — user ${userId} has no push tokens. ` +
          `Confirm the app called POST /users/me/push-token or /users/me/web-push-subscription.`,
        )
      }

      await Promise.allSettled(pushJobs)
    } catch (err) {
      this.logger.warn(`Push notification failed for user ${userId}: ${String(err)}`)
    }
  }

  // ── Order lifecycle events ───────────────────────────────────────

  async onOrderPlaced(
    customerId: string,
    restaurantOwnerId: string,
    orderNumber: string,
    orderId: string,
  ): Promise<void> {
    await Promise.all([
      // Customer confirmation
      this.send(
        customerId,
        NotificationType.ORDER_STATUS,
        'Order placed!',
        `Your order ${orderNumber} has been received and is awaiting confirmation.`,
        { orderId, status: OrderStatus.PENDING },
      ),
      // Restaurant new order alert
      this.send(
        restaurantOwnerId,
        NotificationType.NEW_ORDER,
        'New order received',
        `Order ${orderNumber} is waiting for your confirmation.`,
        { orderId },
      ),
    ])
  }

  async onOrderStatusChanged(
    customerId: string,
    orderNumber: string,
    orderId: string,
    status: OrderStatus,
  ): Promise<void> {
    const messages: Record<OrderStatus, { title: string; body: string }> = {
      [OrderStatus.PENDING]:   { title: 'Order received', body: `${orderNumber} is pending.` },
      [OrderStatus.CONFIRMED]: { title: 'Order confirmed!', body: `${orderNumber} has been confirmed and will start preparing soon.` },
      [OrderStatus.PREPARING]: { title: 'Being prepared', body: `The restaurant is now preparing ${orderNumber}.` },
      [OrderStatus.READY]:     { title: 'Ready for pickup', body: `${orderNumber} is ready — a rider is on the way.` },
      [OrderStatus.PICKED_UP]: { title: 'On the way!', body: `Your rider has picked up ${orderNumber} and is heading to you.` },
      [OrderStatus.DELIVERED]: { title: 'Delivered!', body: `${orderNumber} has been delivered. Enjoy your meal!` },
      [OrderStatus.CANCELLED]: { title: 'Order cancelled', body: `${orderNumber} has been cancelled.` },
    }

    const msg = messages[status]
    await this.send(customerId, NotificationType.ORDER_STATUS, msg.title, msg.body, {
      orderId,
      status,
    })

    // After delivery send a separate in-app nudge asking for a rating.
    // Delay 2 minutes so it doesn't fire at the same moment as the delivered push.
    if (status === OrderStatus.DELIVERED) {
      setTimeout(() => {
        void this.send(
          customerId,
          NotificationType.ORDER_STATUS,
          'How was your order?',
          `Rate your experience for order ${orderNumber}. It helps us improve!`,
          { orderId, action: 'rate_order' },
        ).catch(() => undefined)
      }, 2 * 60 * 1000)
    }

    // SMS on key transitions. Fire-and-forget — an SMS provider outage must
    // never break the underlying status transition or the push we just sent.
    // Respects user's smsOptIn preference (transactional; defaults true).
    const smsSuffix = SMS_STATUS_MESSAGES[status]
    if (smsSuffix) {
      const user = await this.usersService.findById(customerId).catch(() => null)
      if (user?.phone && user.smsOptIn !== false) {
        void this.termii
          .sendTransactional(user.phone, `GrandXL: Order ${orderNumber} ${smsSuffix}`)
          .catch(() => undefined)
      }
    }
  }

  async onRiderAssigned(riderId: string, orderNumber: string, orderId: string): Promise<void> {
    await this.send(
      riderId,
      NotificationType.RIDER_JOB,
      'New delivery job',
      `You have been assigned order ${orderNumber}. Head to the restaurant to pick it up.`,
      { orderId },
    )
  }

  // Fired when a rider accepts a job — pushes a notification to the restaurant owner
  // so they know to start preparing even if no one is watching the admin dashboard.
  async onRiderComingToPickup(
    restaurantOwnerId: string,
    riderUserId: string,
    orderNumber: string,
    orderId: string,
  ): Promise<void> {
    // Look up rider's name for a personal, actionable message
    const riderUser = await this.usersService.findById(riderUserId).catch(() => null)
    const riderName = riderUser ? `${riderUser.firstName} ${riderUser.lastName}`.trim() : 'A rider'

    await this.send(
      restaurantOwnerId,
      NotificationType.ORDER_STATUS,
      '🏍️ Rider on the way!',
      `${riderName} has accepted order ${orderNumber} and is heading to you. Please have it ready.`,
      { orderId, action: 'rider_coming' },
    )

    // Also SMS the restaurant owner — covers the case where no one has the dashboard open
    const owner = await this.usersService.findById(restaurantOwnerId).catch(() => null)
    if (owner?.phone) {
      void this.termii
        .sendTransactional(
          owner.phone,
          `GrandXL: ${riderName} is on the way to pick up order ${orderNumber}. Please have it ready for collection.`,
        )
        .catch(() => undefined)
    }
  }

  async onOrderReady(riderUserId: string, orderNumber: string, orderId: string): Promise<void> {
    await this.send(
      riderUserId,
      NotificationType.RIDER_JOB,
      'Food is ready!',
      `${orderNumber} is packed and waiting. Head to the restaurant to pick it up.`,
      { orderId },
    )
  }

  // ── Admin fan-out ────────────────────────────────────────────────

  async sendToAdmins(
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const admins = await this.usersService.findAllByRole(UserRole.SUPER_ADMIN)
    if (admins.length === 0) return
    await Promise.allSettled(
      admins.map((admin) => this.send(String(admin._id), type, title, body, data)),
    )
  }

  // ── Business event triggers ──────────────────────────────────────

  async onRestaurantApplied(restaurantId: string, restaurantName: string): Promise<void> {
    void this.sendToAdmins(
      NotificationType.RESTAURANT_APPLIED,
      'New restaurant application',
      `${restaurantName} has submitted for review. Check the restaurants panel.`,
      { targetType: 'restaurant', restaurantId },
    ).catch(() => undefined)
  }

  async onRiderRegistered(riderId: string, riderName: string): Promise<void> {
    void this.sendToAdmins(
      NotificationType.RIDER_REGISTERED,
      'New rider registered',
      `${riderName} has registered and is awaiting KYC review.`,
      { targetType: 'rider', riderId },
    ).catch(() => undefined)
  }

  async onAdminActionOnRestaurant(
    ownerId: string,
    restaurantName: string,
    action: 'approved' | 'rejected' | 'suspended' | 'reinstated' | 'terminated' | 'info_requested',
    detail?: string,
  ): Promise<void> {
    const messages: Record<typeof action, { title: string; body: string }> = {
      approved:      { title: 'Restaurant approved!', body: `${restaurantName} has been approved and is now live on GrandXL.` },
      rejected:      { title: 'Application rejected', body: `${restaurantName}: ${detail ?? 'Your application did not meet our requirements.'}` },
      suspended:     { title: 'Restaurant suspended', body: `${restaurantName} has been suspended. Reason: ${detail ?? 'Contact support.'}` },
      reinstated:    { title: 'Restaurant reinstated', body: `${restaurantName} has been reinstated and is live again.` },
      terminated:    { title: 'Restaurant terminated', body: `${restaurantName} has been permanently removed from GrandXL.` },
      info_requested:{ title: 'Information requested', body: `More details needed for ${restaurantName}: ${detail ?? 'Check your dashboard.'}` },
    }
    const msg = messages[action]
    void this.send(ownerId, NotificationType.ADMIN_ACTION, msg.title, msg.body, {
      targetType: 'restaurant',
      action,
    }).catch(() => undefined)
  }

  async onAdminActionOnRider(
    riderUserId: string,
    action: 'verified' | 'suspended' | 'reinstated' | 'terminated',
    detail?: string,
  ): Promise<void> {
    const messages: Record<typeof action, { title: string; body: string }> = {
      verified:   { title: 'Account verified!', body: 'Your rider account has been verified. You can now go online and accept deliveries.' },
      suspended:  { title: 'Account suspended', body: `Your rider account has been suspended. Reason: ${detail ?? 'Contact support.'}` },
      reinstated: { title: 'Account reinstated', body: 'Your rider account has been reinstated. You can now go online again.' },
      terminated: { title: 'Account terminated', body: 'Your rider account has been permanently deactivated.' },
    }
    const msg = messages[action]
    void this.send(riderUserId, NotificationType.ADMIN_ACTION, msg.title, msg.body, {
      targetType: 'rider',
      action,
    }).catch(() => undefined)
  }

  // ── Customer — read notifications ────────────────────────────────

  async getMyNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: NotificationDocument[]; unreadCount: number; total: number }> {
    const filter = { userId: new Types.ObjectId(userId) }
    const skip = (page - 1) * limit

    const [notifications, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({ ...filter, isRead: false }),
    ])

    return {
      notifications: notifications as unknown as NotificationDocument[],
      unreadCount,
      total,
    }
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(notificationId)) throw new NotFoundException('Notification not found')
    const notification = await this.notificationModel.findById(notificationId)
    if (!notification) throw new NotFoundException('Notification not found')
    if (notification.userId.toString() !== userId) {
      throw new ForbiddenException('You do not own this notification')
    }
    await this.notificationModel.findByIdAndUpdate(notificationId, { $set: { isRead: true } })
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } },
    )
  }
}
