import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AuditService } from './audit.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'

@ApiTags('audit')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries (admin only)' })
  async list(
    @Query('actorId')    actorId?:    string,
    @Query('targetType') targetType?: string,
    @Query('targetId')   targetId?:   string,
    @Query('action')     action?:     string,
    @Query('from')       from?:       string,
    @Query('to')         to?:         string,
    @Query('page')       page?:       string,
    @Query('limit')      limit?:      string,
  ) {
    return this.audit.list({
      actorId,
      targetType,
      targetId,
      action,
      from:  from  ? new Date(from)  : undefined,
      to:    to    ? new Date(to)    : undefined,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }
}
