import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { BannersService } from './banners.service'
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

// ── Public ──────────────────────────────────────────────────────────

@ApiTags('Banners')
@Controller('banners')
export class PublicBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List currently visible hero banners' })
  list() {
    return this.banners.listActive()
  }
}

// ── Admin ────────────────────────────────────────────────────────────

@ApiTags('Admin — Banners')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'List all banners' })
  list() {
    return this.banners.listAll()
  }

  @Post()
  @ApiOperation({ summary: 'Create a banner' })
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a banner' })
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a banner' })
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.banners.delete(id)
  }
}
