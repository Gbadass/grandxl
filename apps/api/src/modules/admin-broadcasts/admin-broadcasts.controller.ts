import { Body, Controller, DefaultValuePipe, Get, HttpCode, HttpStatus, ParseIntPipe, Post, Query, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger'
import type { Request } from 'express'
import { AdminBroadcastsService } from './admin-broadcasts.service'
import { CreateBroadcastDto } from './dto/broadcast.dto'
import { AuditService } from '../audit/audit.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Admin — Broadcasts')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/broadcasts')
export class AdminBroadcastsController {
  constructor(
    private readonly broadcasts: AdminBroadcastsService,
    private readonly audit:      AuditService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a system-wide announcement to one or more audience roles' })
  @ApiCreatedResponse({ description: '{ broadcastId, recipientCount, deliveredCount }' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBroadcastDto,
    @Req() req: Request,
  ) {
    const result = await this.broadcasts.create(user.sub, {
      audiences: dto.audiences,
      title:     dto.title,
      body:      dto.body,
      actionUrl: dto.actionUrl,
    })
    void this.audit.log({
      actorId:    user.sub,
      ipAddress:  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent:  req.headers['user-agent'],
      action:     'broadcast.send',
      targetType: 'broadcast',
      targetId:   result.broadcastId,
      metadata:   {
        audiences:      dto.audiences,
        recipientCount: result.recipientCount,
        deliveredCount: result.deliveredCount,
        title:          dto.title,
      },
    })
    return result
  }

  @Get()
  @ApiOperation({ summary: 'List past broadcasts' })
  @ApiOkResponse({ description: 'Paginated broadcast history' })
  list(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page:  number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.broadcasts.list(page, Math.min(limit, 100))
  }
}
