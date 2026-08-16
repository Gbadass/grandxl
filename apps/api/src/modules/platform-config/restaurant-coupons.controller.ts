import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { PlatformConfigService } from './platform-config.service'
import { CreateCouponDto } from './dto/create-coupon.dto'
import { RestaurantsService } from '../restaurants/restaurants.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

// Restaurant-owner-scoped coupon management. Each endpoint resolves the owner's
// restaurant first, then scopes the coupon op to it. Owners can never touch
// platform-wide or other-restaurant coupons.
@ApiTags('Restaurant — Coupons')
@ApiBearerAuth()
@Roles(UserRole.RESTAURANT_OWNER)
@Controller('restaurant/coupons')
export class RestaurantCouponsController {
  constructor(
    private readonly platformConfigService: PlatformConfigService,
    private readonly restaurantsService:    RestaurantsService,
  ) {}

  private async resolveOwnerRestaurantId(ownerId: string): Promise<string> {
    const restaurants = await this.restaurantsService.findByOwner(ownerId)
    if (!restaurants.length) {
      throw new NotFoundException('No restaurant found for this owner')
    }
    // v1 assumption: one restaurant per owner. When multi-location lands we'll
    // accept a `:restaurantId` param and verify ownership.
    return restaurants[0]._id.toString()
  }

  @Post()
  @ApiOperation({ summary: 'Create a coupon for my restaurant' })
  @ApiCreatedResponse({ description: 'Coupon created' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCouponDto) {
    const restaurantId = await this.resolveOwnerRestaurantId(user.sub)
    return this.platformConfigService.createRestaurantCoupon(user.sub, restaurantId, dto)
  }

  @Get()
  @ApiOperation({ summary: 'List coupons for my restaurant' })
  @ApiOkResponse({ description: 'Coupon list' })
  async list(@CurrentUser() user: JwtPayload) {
    const restaurantId = await this.resolveOwnerRestaurantId(user.sub)
    return this.platformConfigService.listRestaurantCoupons(restaurantId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a coupon I created' })
  @ApiOkResponse({ description: 'Coupon deactivated' })
  async deactivate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const restaurantId = await this.resolveOwnerRestaurantId(user.sub)
    return this.platformConfigService.deactivateRestaurantCoupon(user.sub, restaurantId, id)
  }
}
