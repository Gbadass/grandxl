import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { RidersService } from '../riders/riders.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'

// S13-13: unified blocklist for both customer bans and rider suspensions/
// terminations. Two GETs (customers/riders) rather than one union so each
// side returns its own natural document shape without cross-schema squishing.
@ApiTags('Admin — Blocklist')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/blocklist')
export class AdminBlocklistController {
  constructor(
    private readonly usersService:  UsersService,
    private readonly ridersService: RidersService,
  ) {}

  @Get('customers')
  @ApiOperation({ summary: 'List banned customer accounts' })
  @ApiOkResponse({ description: 'Paginated banned-customers list' })
  async listBannedCustomers(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('search') search?: string,
  ) {
    return this.usersService.listBannedUsers(
      page  ? parseInt(page, 10)  : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    )
  }

  @Get('riders')
  @ApiOperation({ summary: 'List suspended + terminated riders' })
  @ApiOkResponse({ description: 'Paginated blocked-riders list' })
  async listBlockedRiders(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('search') search?: string,
  ) {
    return this.ridersService.listBlockedRiders(
      page  ? parseInt(page, 10)  : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    )
  }
}
