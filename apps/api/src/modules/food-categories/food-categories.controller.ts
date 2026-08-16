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
  Req,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { FoodCategoriesService } from './food-categories.service'
import { CreateFoodCategoryDto, UpdateFoodCategoryDto } from './dto/food-category.dto'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

interface AuthenticatedRequest extends Request {
  user: { sub: string; roles: UserRole[] }
}

@ApiTags('Food Categories')
@Controller('food-categories')
export class FoodCategoriesController {
  constructor(private readonly service: FoodCategoriesService) {}

  // ── Public — list active categories (used by mobile app) ─────────

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active food categories' })
  @ApiOkResponse({ description: 'Array of food categories' })
  async findAll() {
    return this.service.findAll()
  }

  // ── Admin — list all (including inactive) ────────────────────────

  @Get('admin/all')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list all food categories' })
  async findAllAdmin() {
    return this.service.findAllAdmin()
  }

  // ── Restaurant owner — create new category ────────────────────────

  @Post()
  @Roles(UserRole.RESTAURANT_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a food category (restaurant owner)' })
  @ApiCreatedResponse({ description: 'Created food category' })
  async create(
    @Body() dto: CreateFoodCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(req.user.sub, dto)
  }

  // ── Owner or admin — update ──────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a food category' })
  @ApiOkResponse({ description: 'Updated food category' })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateFoodCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, req.user.sub, req.user.roles, dto)
  }

  // ── Owner or admin — delete ──────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a food category' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.service.remove(id, req.user.sub, req.user.roles)
  }
}
