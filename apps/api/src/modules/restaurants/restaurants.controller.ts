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
} from '@nestjs/swagger'
import { RestaurantsService } from './restaurants.service'
import { CreateRestaurantDto } from './dto/create-restaurant.dto'
import { UpdateRestaurantDto } from './dto/update-restaurant.dto'
import { QueryRestaurantsDto } from './dto/query-restaurants.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  // ── Public — browse restaurants ──────────────────────────────────

  @Get()
  @Public()
  @ApiOperation({ summary: 'List approved restaurants — optionally filtered by location and cuisine' })
  @ApiOkResponse({ description: 'Paginated list of restaurants' })
  async findAll(@Query() query: QueryRestaurantsDto) {
    return this.restaurantsService.findAll(query)
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single restaurant by ID' })
  @ApiOkResponse({ description: 'Restaurant details' })
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    const doc = await this.restaurantsService.findById(id)
    return this.restaurantsService.toPublicRestaurant(doc)
  }

  // ── Restaurant owner — manage their own restaurant ───────────────

  @Post()
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new restaurant (restaurant owner)' })
  @ApiCreatedResponse({ description: 'Restaurant created — pending review' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRestaurantDto,
  ) {
    const doc = await this.restaurantsService.create(user.sub, dto)
    return this.restaurantsService.toPublicRestaurant(doc)
  }

  @Get('my/restaurants')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all restaurants owned by the authenticated user' })
  async getMyRestaurants(@CurrentUser() user: JwtPayload) {
    return this.restaurantsService.findByOwner(user.sub)
  }

  @Patch(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update restaurant details (owner or super_admin)' })
  @ApiOkResponse({ description: 'Restaurant updated' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    const doc = await this.restaurantsService.update(id, user.sub, user.roles as UserRole[], dto)
    return this.restaurantsService.toPublicRestaurant(doc)
  }

  @Patch(':id/submit-for-review')
  @Roles(UserRole.RESTAURANT_OWNER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit restaurant for GrandXL team review (owner)' })
  @ApiOkResponse({ description: 'Restaurant submitted for review' })
  async submitForReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const doc = await this.restaurantsService.submitForReview(id, user.sub)
    return this.restaurantsService.toPublicRestaurant(doc)
  }
}
