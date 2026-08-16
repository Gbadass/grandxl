import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { AuditLogDocument } from './schemas/audit-log.schema'

export interface AuditEntry {
  actorId: string
  actorEmail?: string
  action: string
  targetType: string
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(
    @InjectModel(AuditLogDocument.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  // Fire-and-forget on the write path — audit failure must never break the action it logs.
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create({
        actorId:    new Types.ObjectId(entry.actorId),
        actorEmail: entry.actorEmail,
        action:     entry.action,
        targetType: entry.targetType,
        targetId:   entry.targetId,
        metadata:   entry.metadata,
        ipAddress:  entry.ipAddress,
        userAgent:  entry.userAgent,
      })
    } catch (err) {
      this.logger.error(`audit write failed: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  async list(opts: {
    actorId?: string
    targetType?: string
    targetId?: string
    action?: string
    from?: Date
    to?: Date
    page?: number
    limit?: number
  }) {
    const page  = Math.max(1, opts.page ?? 1)
    const limit = Math.min(100, opts.limit ?? 50)
    const skip  = (page - 1) * limit

    const filter: Record<string, unknown> = {}
    if (opts.actorId)    filter['actorId']    = new Types.ObjectId(opts.actorId)
    if (opts.targetType) filter['targetType'] = opts.targetType
    if (opts.targetId)   filter['targetId']   = opts.targetId
    if (opts.action)     filter['action']     = opts.action
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {}
      if (opts.from) range['$gte'] = opts.from
      if (opts.to)   range['$lte'] = opts.to
      filter['createdAt'] = range
    }

    const [items, total] = await Promise.all([
      this.auditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.auditModel.countDocuments(filter).exec(),
    ])

    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }
}
