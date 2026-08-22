import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger'
import { DisputesService } from './disputes.service'
import { CreateDisputeDto, UpdateDisputeDto } from './dto/dispute.dto'
import { DisputeStatus } from './schemas/dispute.schema'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Disputes')
@ApiBearerAuth()
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  // ── Customer — open a dispute ─────────────────────────────────────

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Open a dispute for an order' })
  @ApiCreatedResponse({ description: 'Dispute created' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.disputesService.create(user.sub, dto)
  }

  // ── Customer — list their disputes ────────────────────────────────

  @Get('my')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'List disputes raised by the authenticated customer' })
  @ApiOkResponse({ description: 'Paginated list of disputes' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listMy(
    @CurrentUser() user: JwtPayload,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.disputesService.listForCustomer(user.sub, page, limit)
  }

  // ── Admin — list all disputes ─────────────────────────────────────

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all disputes (admin). Filter by ?status=' })
  @ApiOkResponse({ description: 'Paginated list of disputes' })
  @ApiQuery({ name: 'status', required: false, enum: DisputeStatus })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  async listAll(
    @Query('status') status: DisputeStatus | undefined,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.disputesService.listForAdmin(status, page, limit)
  }

  // ── Admin — resolve a dispute ─────────────────────────────────────

  @Patch(':id/resolve')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resolve a dispute (admin)' })
  @ApiOkResponse({ description: 'Dispute resolved' })
  async resolve(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDisputeDto,
  ) {
    return this.disputesService.resolve(user.sub, id, dto.resolution ?? '')
  }
}
