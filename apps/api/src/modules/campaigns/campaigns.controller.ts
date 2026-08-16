import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { CampaignsService } from './campaigns.service'
import { CreateCampaignDto } from './dto/campaign.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { AuditService } from '../audit/audit.service'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Admin — Campaigns')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/campaigns')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly audit:     AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns' })
  list(
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.campaigns.listAll(
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  @Post()
  @ApiOperation({ summary: 'Create a campaign draft' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.sub, dto)
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Queue a draft campaign for send' })
  async send(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    const result = await this.campaigns.send(id)
    void this.audit.log({
      actorId:    user.sub,
      ipAddress:  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent:  req.headers['user-agent'],
      action:     'campaign.send',
      targetType: 'campaign',
      targetId:   id,
      metadata:   { audience: result.audience, targetCount: result.targetCount },
    })
    return result
  }
}
