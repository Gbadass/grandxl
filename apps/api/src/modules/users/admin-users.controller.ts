import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { UsersService } from './users.service'
import { AuditService } from '../audit/audit.service'
import { FraudService } from '../fraud/fraud.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Admin — Users')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
    private readonly fraud: FraudService,
  ) {}

  private auditMeta(req: Request, user: JwtPayload) {
    return {
      actorId:   user.sub,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: req.headers['user-agent'],
    }
  }

  @Get()
  @ApiOperation({ summary: 'List customer accounts (admin)' })
  @ApiOkResponse({ description: 'Paginated user list' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.listUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    )
  }

  @Patch(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a user — prevents login' })
  @ApiOkResponse({ description: 'User banned' })
  async banUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    await this.usersService.banUser(id)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'user.ban', targetType: 'user', targetId: id })
    return { banned: true }
  }

  @Patch(':id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban a user — restores access' })
  @ApiOkResponse({ description: 'User unbanned' })
  async unbanUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    await this.usersService.unbanUser(id)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'user.unban', targetType: 'user', targetId: id })
    return { banned: false }
  }

  @Patch(':id/risk-flags/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all risk flags on a user' })
  @ApiOkResponse({ description: 'Flags cleared' })
  async clearRiskFlags(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    await this.fraud.clearAllFlags(id)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'user.risk_flags_clear', targetType: 'user', targetId: id })
    return { cleared: true }
  }
}
