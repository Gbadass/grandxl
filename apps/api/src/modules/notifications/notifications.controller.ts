import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { NotificationsService } from './notifications.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('vapid-public-key')
  @Public()
  @ApiOperation({ summary: 'Get VAPID public key for Web Push subscription' })
  @ApiOkResponse({ description: 'VAPID public key' })
  getVapidPublicKey() {
    return { publicKey: this.config.get<string>('VAPID_PUBLIC_KEY') ?? '' }
  }

  @Get('my')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @ApiOperation({ summary: 'Get notifications for the current user' })
  @ApiOkResponse({ description: 'Paginated notifications with unread count' })
  async getMyNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  @Patch(':id/read')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiNoContentResponse({ description: 'Marked as read' })
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.notificationsService.markAsRead(user.sub, id)
  }

  @Patch('read-all')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiNoContentResponse({ description: 'All marked as read' })
  async markAllRead(@CurrentUser() user: JwtPayload) {
    await this.notificationsService.markAllRead(user.sub)
  }
}
