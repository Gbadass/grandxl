import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
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
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger'
import { RidersService } from './riders.service'
import { OrdersService } from '../orders/orders.service'
import { RegisterRiderDto } from './dto/register-rider.dto'
import { UpdateLocationDto } from './dto/update-location.dto'
import { UpdateAvailabilityDto } from './dto/update-availability.dto'
import { UpdateDocumentsDto } from './dto/update-documents.dto'
import { QueryOrdersDto } from '../orders/dto/query-orders.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Riders')
@ApiBearerAuth()
@Controller('riders')
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly ordersService: OrdersService,
  ) {}

  // ── Rider self-service ───────────────────────────────────────────

  @Post('register')
  @Roles(UserRole.RIDER, UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Create rider profile (one-time setup after account created)' })
  @ApiCreatedResponse({ description: 'Rider profile created — pending verification' })
  async register(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterRiderDto,
  ) {
    return this.ridersService.register(user.sub, dto)
  }

  @Get('me')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get own rider profile' })
  @ApiOkResponse({ description: 'Rider profile' })
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.ridersService.getProfile(user.sub)
  }

  @Patch('me/availability')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Go online or offline' })
  @ApiOkResponse({ description: 'Updated rider profile' })
  async updateAvailability(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.ridersService.updateAvailability(user.sub, dto)
  }

  @Patch('me/location')
  @Roles(UserRole.RIDER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update rider GPS location (called frequently by mobile app)' })
  @ApiNoContentResponse({ description: 'Location updated' })
  async updateLocation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateLocationDto,
  ) {
    await this.ridersService.updateLocation(user.sub, dto)
  }

  @Patch('me/documents')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Submit KYC document URLs after uploading via /uploads/rider-document' })
  @ApiOkResponse({ description: 'Documents saved — pending admin review' })
  async updateDocuments(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDocumentsDto,
  ) {
    return this.ridersService.updateDocuments(user.sub, dto)
  }

  @Get('me/jobs/available')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get orders available for pickup (no rider assigned yet)' })
  @ApiOkResponse({ description: 'List of available orders' })
  async getAvailableJobs() {
    return this.ordersService.getAvailableOrders()
  }

  @Get('me/jobs/active')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get the order currently assigned to this rider' })
  @ApiOkResponse({ description: 'Active order or null' })
  async getActiveJob(@CurrentUser() user: JwtPayload) {
    const rider = await this.ridersService.getProfile(user.sub)
    return this.ordersService.findActiveOrderByRider(String(rider._id))
  }

  @Get('me/jobs/history')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get paginated delivery history for this rider' })
  @ApiOkResponse({ description: 'Paginated completed deliveries' })
  async getDeliveryHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryOrdersDto,
  ) {
    const rider = await this.ridersService.getProfile(user.sub)
    return this.ordersService.getRiderDeliveries(String(rider._id), query)
  }

  @Post('me/jobs/:orderId/accept')
  @Roles(UserRole.RIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a broadcast order — first rider to accept wins' })
  @ApiOkResponse({ description: 'Order accepted and assigned to this rider' })
  async acceptJob(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.ridersService.acceptOrder(user.sub, orderId)
  }

  @Get('me/metrics')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get my performance metrics (on-time %, cancellation rate, avg delivery time)' })
  @ApiOkResponse({ description: 'Rider performance metrics' })
  async getMetrics(
    @CurrentUser() user: JwtPayload,
    @Query('sinceDays') sinceDays?: string,
  ) {
    const rider = await this.ridersService.getProfile(user.sub)
    return this.ordersService.getRiderMetrics(
      String(rider._id),
      sinceDays ? parseInt(sinceDays, 10) : undefined,
    )
  }
}
