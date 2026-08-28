import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { BroadcastDocument } from './schemas/broadcast.schema'
import { UsersService } from '../users/users.service'
import { NotificationsService } from '../notifications/notifications.service'
import { NotificationType, UserRole } from '@grandxl/types'

// Sprint 13 (S13-8): safety cap on how many users a single broadcast can hit
// synchronously. Well above expected per-role sizes for the current audience;
// keeps a bad query from fanning out to 100k in one call. Bump + move to a
// queued job when we outgrow it.
const MAX_RECIPIENTS_PER_BROADCAST = 10_000

@Injectable()
export class AdminBroadcastsService {
  private readonly logger = new Logger(AdminBroadcastsService.name)

  constructor(
    @InjectModel(BroadcastDocument.name)
    private readonly broadcastModel: Model<BroadcastDocument>,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actorId: string, args: {
    audiences: UserRole[]
    title:     string
    body:      string
    actionUrl?: string
  }): Promise<{ broadcastId: string; recipientCount: number; deliveredCount: number }> {
    // SUPER_ADMIN broadcasts to super admins would create a loop (an admin
    // spamming an admin notification about a broadcast). Refuse it explicitly.
    if (args.audiences.includes(UserRole.SUPER_ADMIN)) {
      throw new BadRequestException('SUPER_ADMIN is not a valid broadcast audience — use direct in-app comms')
    }

    // Dedupe the audience list so a repeated role doesn't get counted twice.
    const roles = Array.from(new Set(args.audiences)) as UserRole[]

    // Collect recipients across roles and dedupe by user id — a single user
    // with both CUSTOMER + RIDER roles gets one notification, not two.
    const seen = new Set<string>()
    for (const role of roles) {
      const usersForRole = await this.users.findAllByRole(role)
      for (const u of usersForRole) {
        const id = String(u._id)
        seen.add(id)
        if (seen.size > MAX_RECIPIENTS_PER_BROADCAST) {
          throw new BadRequestException(
            `Broadcast would exceed the ${MAX_RECIPIENTS_PER_BROADCAST} recipient cap. Split the audience or contact platform ops.`,
          )
        }
      }
    }

    const recipientIds = Array.from(seen)
    const recipientCount = recipientIds.length

    // Fan out via the existing notification pipeline — in-app row + socket +
    // Expo/web push all handled by NotificationsService.send. Best-effort per
    // recipient; a failed push for one user doesn't roll back the broadcast.
    const results = await Promise.allSettled(
      recipientIds.map((uid) => this.notifications.send(
        uid,
        NotificationType.SYSTEM,
        args.title,
        args.body,
        { broadcast: true, actionUrl: args.actionUrl ?? null },
      )),
    )
    const deliveredCount = results.filter((r) => r.status === 'fulfilled').length

    const doc = await this.broadcastModel.create({
      actorId:        new Types.ObjectId(actorId),
      audiences:      roles,
      title:          args.title,
      body:           args.body,
      actionUrl:      args.actionUrl ?? null,
      recipientCount,
      deliveredCount,
      sentAt:         new Date(),
    })

    this.logger.log(
      `Broadcast ${doc._id.toString()} → ${recipientCount} recipients across [${roles.join(', ')}], delivered ${deliveredCount}`,
    )

    return { broadcastId: doc._id.toString(), recipientCount, deliveredCount }
  }

  async list(page = 1, limit = 20): Promise<{
    items: BroadcastDocument[]; total: number; page: number; limit: number; pages: number
  }> {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.broadcastModel.find().sort({ sentAt: -1 }).skip(skip).limit(limit)
        .populate('actorId', 'firstName lastName')
        .lean() as unknown as Promise<BroadcastDocument[]>,
      this.broadcastModel.countDocuments(),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 }
  }
}
