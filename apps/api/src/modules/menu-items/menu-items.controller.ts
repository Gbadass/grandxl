import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { MenuItemsService } from './menu-items.service'
import { CreateMenuCategoryDto, UpdateMenuCategoryDto } from './dto/menu-category.dto'
import {
  CreateMenuItemDto, UpdateMenuItemDto,
  BulkAvailabilityDto, BulkCategoryDto, BulkPriceDto, BulkItemIdsDto,
  BulkFeaturedDto,
} from './dto/menu-item.dto'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Menu')
@Controller()
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  // ── Public — read-only menu endpoints ───────────────────────────

  @Get('restaurants/:restaurantId/menu')
  @Public()
  @ApiOperation({ summary: 'Get full menu (categories + items) for a restaurant' })
  @ApiOkResponse({ description: 'Categories and items' })
  async getMenu(@Param('restaurantId', ParseObjectIdPipe) restaurantId: string) {
    return this.menuItemsService.getMenuByRestaurant(restaurantId)
  }

  @Get('restaurants/:restaurantId/categories')
  @Public()
  @ApiOperation({ summary: 'List active categories for a restaurant' })
  @ApiOkResponse({ description: 'Array of categories' })
  async getCategories(@Param('restaurantId', ParseObjectIdPipe) restaurantId: string) {
    return this.menuItemsService.getCategories(restaurantId)
  }

  @Get('menu-items/:id')
  @Public()
  @ApiOperation({ summary: 'Get a single menu item by ID' })
  @ApiOkResponse({ description: 'Menu item details' })
  async getItem(@Param('id', ParseObjectIdPipe) id: string) {
    return this.menuItemsService.getItemById(id)
  }

  // ── Restaurant owner — manage categories ─────────────────────────

  @Post('restaurants/:restaurantId/categories')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a menu category (owner)' })
  @ApiCreatedResponse({ description: 'Category created' })
  async createCategory(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Body() dto: CreateMenuCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.createCategory(restaurantId, dto, user.sub, user.roles.includes(UserRole.SUPER_ADMIN))
  }

  @Patch('restaurants/:restaurantId/categories/:id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu category (owner)' })
  @ApiOkResponse({ description: 'Category updated' })
  async updateCategory(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateMenuCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.updateCategory(id, restaurantId, dto, user.sub, user.roles.includes(UserRole.SUPER_ADMIN))
  }

  @Delete('restaurants/:restaurantId/categories/:id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a menu category (owner) — blocked if items exist' })
  @ApiNoContentResponse({ description: 'Category deleted' })
  async deleteCategory(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.menuItemsService.deleteCategory(id, restaurantId, user.sub, user.roles.includes(UserRole.SUPER_ADMIN))
  }

  // ── Restaurant owner — manage items ──────────────────────────────

  @Post('restaurants/:restaurantId/menu-items')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a menu item (owner)' })
  @ApiCreatedResponse({ description: 'Menu item created' })
  async createItem(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.createItem(restaurantId, dto, user.sub, user.roles.includes(UserRole.SUPER_ADMIN))
  }

  @Patch('restaurants/:restaurantId/menu-items/:id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu item (owner)' })
  @ApiOkResponse({ description: 'Menu item updated' })
  async updateItem(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.updateItem(id, restaurantId, dto, user.sub, user.roles.includes(UserRole.SUPER_ADMIN))
  }

  @Delete('restaurants/:restaurantId/menu-items/:id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a menu item (owner)' })
  @ApiNoContentResponse({ description: 'Menu item deleted' })
  async deleteItem(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.menuItemsService.deleteItem(id, restaurantId, user.sub, user.roles.includes(UserRole.SUPER_ADMIN))
  }

  // ── Sprint 12 (S12-7): bulk edit ─────────────────────────────────

  @Post('restaurants/:restaurantId/menu-items/bulk-availability')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk toggle availability on N items (owner)' })
  @ApiOkResponse({ description: '{ modifiedCount }' })
  async bulkSetAvailability(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Body() dto: BulkAvailabilityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.bulkSetAvailability(
      restaurantId, dto.itemIds, dto.isAvailable, user.sub, user.roles.includes(UserRole.SUPER_ADMIN),
    )
  }

  @Post('restaurants/:restaurantId/menu-items/bulk-featured')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk mark N items as featured / remove featured (owner)' })
  @ApiOkResponse({ description: '{ modifiedCount }' })
  async bulkSetFeatured(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Body() dto: BulkFeaturedDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.bulkSetFeatured(
      restaurantId, dto.itemIds, dto.isFeatured, user.sub, user.roles.includes(UserRole.SUPER_ADMIN),
    )
  }

  @Post('restaurants/:restaurantId/menu-items/bulk-category')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk reassign N items to a different category (owner)' })
  @ApiOkResponse({ description: '{ modifiedCount }' })
  async bulkMoveCategory(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Body() dto: BulkCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.bulkMoveCategory(
      restaurantId, dto.itemIds, dto.categoryId, user.sub, user.roles.includes(UserRole.SUPER_ADMIN),
    )
  }

  @Post('restaurants/:restaurantId/menu-items/bulk-price')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk adjust prices on N items (percent/fixed/set)' })
  @ApiOkResponse({ description: '{ modifiedCount }' })
  async bulkAdjustPrice(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Body() dto: BulkPriceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.bulkAdjustPrice(
      restaurantId, dto.itemIds, dto.mode, dto.value, user.sub, user.roles.includes(UserRole.SUPER_ADMIN),
    )
  }

  @Post('restaurants/:restaurantId/menu-items/bulk-delete')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk delete N items (owner)' })
  @ApiOkResponse({ description: '{ deletedCount }' })
  async bulkDelete(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Body() dto: BulkItemIdsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.menuItemsService.bulkDelete(
      restaurantId, dto.itemIds, user.sub, user.roles.includes(UserRole.SUPER_ADMIN),
    )
  }
}
