import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import type { Request } from 'express'
import { AuditService } from '../audit/audit.service'
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
import { RateOrderDto } from './dto/rate-order.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { Idempotent } from '../../common/decorators/idempotent.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole, OrderStatus } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly audit:         AuditService,
  ) {}

  // ── Customer — place and view their orders ───────────────────────

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @ApiOperation({ summary: 'Get live pricing estimate before placing an order — shows surge, zone multiplier, discount' })
  @ApiOkResponse({ description: 'Pricing breakdown returned' })
  async estimateOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.estimateOrder(user.sub, dto)
  }

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
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the current customer order history' })
  @ApiOkResponse({ description: 'Paginated order list' })
  async getMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.getCustomerOrders(user.sub, query)
  }

  @Get('my/:id')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single order (customer must own it)' })
  @ApiOkResponse({ description: 'Order details' })
  async getMyOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.ordersService.getCustomerOrderById(id, user.sub)
  }

  @Post('my/:id/rate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rate a delivered order — 1–5 stars + optional review text' })
  @ApiOkResponse({ description: 'Rating recorded' })
  async rateOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RateOrderDto,
  ) {
    return this.ordersService.rateOrder(id, user.sub, dto)
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
    @Req() req: Request,
  ) {
    // Super-admin transitions (Force pickup / delivered / cancel from the ops
    // console) route through this shared endpoint. Log the INTENT before the
    // service call so that failed attempts (invalid transition, 409 concurrent
    // edit) still leave a record — the audit trail exists to answer "who tried
    // to do what", not just "what succeeded".
    // Customer/restaurant/rider role transitions are NOT logged here; those
    // are normal business events and would flood the audit collection.
    const isAdmin = user.roles.includes(UserRole.SUPER_ADMIN)
    if (isAdmin) {
      void this.audit.log({
        actorId:    user.sub,
        ipAddress:  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
        userAgent:  req.headers['user-agent'],
        action:     dto.status === OrderStatus.CANCELLED ? 'orders.admin_cancel' : 'orders.admin_status_change',
        targetType: 'order',
        targetId:   id,
        metadata:   {
          to:           dto.status,
          cancelReason: dto.cancelReason ?? null,
        },
      })
    }
    return this.ordersService.updateStatus(id, dto, user)
  }

  // ── Restaurant owner — view orders for their restaurant ──────────

  @Get('restaurant/:restaurantId')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List orders for a restaurant (owner or admin)' })
  @ApiOkResponse({ description: 'Paginated order list' })
  async getRestaurantOrders(
    @CurrentUser() user: JwtPayload,
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.getRestaurantOrders(restaurantId, query, user)
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

  // Customer contact — rider only, for tap-to-call on active delivery
  @Get(':id/customer-contact')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get the customer\'s contact info for tap-to-call (rider only)' })
  @ApiOkResponse({ description: 'Customer name and phone' })
  async getCustomerContact(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.ordersService.getCustomerContactForOrder(id, user.sub)
  }
}
