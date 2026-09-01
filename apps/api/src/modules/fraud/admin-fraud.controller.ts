import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import { UsersService } from '../users/users.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'

// S13-10: read-only "who's flagged right now" surface for the fraud dashboard.
// Mutations (clear flag / clear all flags) live on the users controller next
// to the existing ban/unban actions — same target (a user), same auth pattern.
@ApiTags('Admin — Fraud')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/fraud')
export class AdminFraudController {
  constructor(private readonly usersService: UsersService) {}

  @Get('flagged-users')
  @ApiOperation({ summary: 'List users with at least one risk flag' })
  @ApiOkResponse({ description: 'Paginated flagged-users list' })
  async listFlaggedUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('code') code?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.listFlaggedUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      code,
      search,
    )
  }
}
