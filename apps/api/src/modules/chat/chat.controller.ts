import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { ChatMessage } from './chat.schema'
import type { ChatMessageDocument } from './chat.schema'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'
import { OrdersService } from '../orders/orders.service'
import { RidersService } from '../riders/riders.service'

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    private readonly ordersService: OrdersService,
    private readonly ridersService: RidersService,
  ) {}

  // ── Auth helper ──────────────────────────────────────────────────

  private async assertParticipant(
    user: JwtPayload,
    orderId: string,
  ): Promise<'customer' | 'rider' | 'admin'> {
    if ((user.roles as string[]).includes(UserRole.SUPER_ADMIN)) return 'admin'

    const order = await this.ordersService.getOrderById(orderId)
    if (order.customerId.toString() === user.sub) return 'customer'

    if ((user.roles as string[]).includes(UserRole.RIDER) && order.riderId) {
      try {
        const riderProfile = await this.ridersService.getProfile(user.sub)
        if (riderProfile._id.toString() === order.riderId.toString()) return 'rider'
      } catch { /* not a rider participant */ }
    }

    throw new ForbiddenException('You are not a participant of this order')
  }

  // ── GET /chat/:orderId/messages ──────────────────────────────────

  @Get(':orderId/messages')
  @ApiOperation({ summary: 'Get paginated chat history for an order (participants only)' })
  @ApiOkResponse({ description: 'Messages + unread count' })
  async getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string, // cursor — ISO timestamp, for "load earlier"
  ): Promise<{ messages: ChatMessageDocument[]; total: number; unreadCount: number }> {
    await this.assertParticipant(user, orderId)

    const parsedPage  = page  ? Math.max(1, parseInt(page, 10))  : 1
    const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 50

    const filter: Record<string, unknown> = {
      orderId:   new Types.ObjectId(orderId),
      deletedAt: null,
    }

    // Cursor-based "load earlier" — client sends ISO timestamp of oldest visible message
    if (before) {
      const cursorDate = new Date(before)
      if (!isNaN(cursorDate.getTime())) {
        filter['createdAt'] = { $lt: cursorDate }
      }
    } else {
      const skip = (parsedPage - 1) * parsedLimit
      const [messages, total, unreadCount] = await Promise.all([
        this.chatMessageModel
          .find(filter)
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(parsedLimit)
          .lean(),
        this.chatMessageModel.countDocuments(filter),
        this.chatMessageModel.countDocuments({
          orderId:   new Types.ObjectId(orderId),
          senderId:  { $ne: new Types.ObjectId(user.sub) },
          readAt:    null,
          deletedAt: null,
        }),
      ])
      return {
        messages:    messages as unknown as ChatMessageDocument[],
        total,
        unreadCount,
      }
    }

    // Cursor path: newest-first so we can slice, then reverse for display
    const messages = await this.chatMessageModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean()

    messages.reverse()

    const unreadCount = await this.chatMessageModel.countDocuments({
      orderId:   new Types.ObjectId(orderId),
      senderId:  { $ne: new Types.ObjectId(user.sub) },
      readAt:    null,
      deletedAt: null,
    })

    return {
      messages:    messages as unknown as ChatMessageDocument[],
      total:       messages.length, // total is approximate in cursor mode
      unreadCount,
    }
  }

  // ── POST /chat/:orderId/read ─────────────────────────────────────
  // REST fallback for marking messages read (WebSocket chat:read is preferred).

  @Post(':orderId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all messages from the other participant as read (REST fallback)' })
  @ApiOkResponse({ description: 'Number of messages marked read' })
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
  ): Promise<{ marked: number }> {
    await this.assertParticipant(user, orderId)

    const result = await this.chatMessageModel.updateMany(
      {
        orderId:   new Types.ObjectId(orderId),
        senderId:  { $ne: new Types.ObjectId(user.sub) },
        readAt:    null,
        deletedAt: null,
      },
      { $set: { isRead: true, readAt: new Date() } },
    )

    return { marked: result.modifiedCount }
  }

  // ── DELETE /chat/:orderId/messages/:messageId ─────────────────────
  // Admin soft-delete — message text is hidden in history responses.

  @Delete(':orderId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a chat message (super_admin only)' })
  @ApiOkResponse({ description: 'Message soft-deleted' })
  async deleteMessage(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
    @Param('messageId', ParseObjectIdPipe) messageId: string,
  ): Promise<{ deleted: boolean }> {
    if (!(user.roles as string[]).includes(UserRole.SUPER_ADMIN)) {
      throw new ForbiddenException('Only admins can delete messages')
    }

    const msg = await this.chatMessageModel.findOneAndUpdate(
      { _id: new Types.ObjectId(messageId), orderId: new Types.ObjectId(orderId) },
      { $set: { deletedAt: new Date() } },
    )
    if (!msg) throw new NotFoundException('Message not found')

    return { deleted: true }
  }
}
