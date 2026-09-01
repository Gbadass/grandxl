import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
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
import * as bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

interface AdminCreateUserDto {
  firstName: string
  lastName: string
  phone?: string
  email?: string
  password: string
  roles: UserRole[]
  country?: string
}

// Ban must carry a reason so the blocklist page can show *why* the account was
// blocked. Server enforces min length so admins can't sneak past by typing "a".
interface BanUserDto {
  reason: string
}

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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user account (admin)' })
  @ApiOkResponse({ description: 'User created' })
  async createUser(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: AdminCreateUserDto,
    @Req() req: Request,
  ) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      passwordHash,
      roles: dto.roles?.length ? dto.roles : [UserRole.CUSTOMER],
      country: dto.country ?? 'NG',
      consentGiven: true,
      consentDate: new Date(),
    })
    void this.audit.log({ ...this.auditMeta(req, actor), action: 'user.create', targetType: 'user', targetId: String(user._id) })
    return { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, roles: user.roles }
  }

  @Patch(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a user — prevents login' })
  @ApiOkResponse({ description: 'User banned' })
  async banUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: BanUserDto,
    @Req() req: Request,
  ) {
    const reason = dto?.reason?.trim() ?? ''
    if (reason.length < 3) {
      throw new BadRequestException('Ban reason is required (min 3 characters)')
    }
    if (reason.length > 500) {
      throw new BadRequestException('Ban reason too long (max 500 characters)')
    }
    await this.usersService.banUser(id, reason, user.sub)
    void this.audit.log({
      ...this.auditMeta(req, user),
      action:     'user.ban',
      targetType: 'user',
      targetId:   id,
      metadata:   { reason },
    })
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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a user — anonymises personal data (NDPR erasure)' })
  @ApiOkResponse({ description: 'User deleted' })
  async deleteUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    await this.usersService.softDeleteAccount(id)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'user.delete', targetType: 'user', targetId: id })
    return { deleted: true }
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

  @Patch(':id/risk-flags/:code/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear a single risk flag by code' })
  @ApiOkResponse({ description: 'Flag cleared' })
  async clearRiskFlag(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('code') code: string,
    @Req() req: Request,
  ) {
    await this.fraud.clearFlag(id, code)
    void this.audit.log({
      ...this.auditMeta(req, user),
      action: 'user.risk_flag_clear',
      targetType: 'user',
      targetId: id,
      metadata: { code },
    })
    return { cleared: true, code }
  }
}
