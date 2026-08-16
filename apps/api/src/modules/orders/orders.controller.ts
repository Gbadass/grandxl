import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
} from '@nestjs/swagger'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { QueryOrdersDto } from './dto/query-orders.dto'
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { Idempotent } from '../../common/decorators/idempotent.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Customer — place and view their orders ───────────────────────

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @Idempotent()
  @ApiOperation({ summary: 'Place a new order (send `Idempotency-Key` to dedupe network retries)' })
  @ApiCreatedResponse({ description: 'Order created — awaiting payment' })
  async createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.sub, dto)
  }

  @Get('my')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @ApiOperation({ summary: 'Get the current customer order history' })
  @ApiOkResponse({ description: 'Paginated order list' })
  async getMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.getCustomerOrders(user.sub, query)
  }

  @Get('my/:id')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @ApiOperation({ summary: 'Get a single order (customer must own it)' })
  @ApiOkResponse({ description: 'Order details' })
  async getMyOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.ordersService.getCustomerOrderById(id, user.sub)
  }

  // ── Shared — update order status ─────────────────────────────────
  // Available to: customer (cancel only), restaurant owner, rider, super_admin

  @Patch(':id/status')
  @Roles(
    UserRole.CUSTOMER,
    UserRole.RESTAURANT_OWNER,
    UserRole.RIDER,
    UserRole.SUPER_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update order status — role-gated transitions enforced in service' })
  @ApiOkResponse({ description: 'Order with updated status' })
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto, user)
  }

  // ── Restaurant owner — view orders for their restaurant ──────────

  @Get('restaurant/:restaurantId')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List orders for a restaurant (owner or admin)' })
  @ApiOkResponse({ description: 'Paginated order list' })
  async getRestaurantOrders(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.getRestaurantOrders(restaurantId, query)
  }

  @Delete('restaurant/:restaurantId/history')
  @Roles(UserRole.RESTAURANT_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all delivered + cancelled orders from restaurant history (soft-delete)' })
  @ApiOkResponse({ description: 'Number of orders cleared' })
  async clearRestaurantHistory(
    @CurrentUser() user: JwtPayload,
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
  ) {
    return this.ordersService.clearRestaurantHistory(restaurantId, user.sub)
  }

  // Restaurant owner — get a single order that belongs to their restaurant
  @Get(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single order (restaurant owner must own the restaurant)' })
  @ApiOkResponse({ description: 'Order details' })
  async getOrderDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.ordersService.getOrderByIdForOwner(id, user)
  }

  // Rider contact — available to the order's customer + restaurant owner + super_admin
  @Get(':id/rider-contact')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the assigned rider\'s contact info for tap-to-call' })
  @ApiOkResponse({ description: 'Rider name, phone, vehicle' })
  async getRiderContact(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.ordersService.getRiderContactForOrder(id, user)
  }
}
