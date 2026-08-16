import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ContentPagesService } from './content-pages.service'
import { UpsertContentPageDto } from './dto/content-page.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

// ── Public ──────────────────────────────────────────────────────────

@ApiTags('Content')
@Controller('content')
export class PublicContentPagesController {
  constructor(private readonly pages: ContentPagesService) {}

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get a published content page by slug (faq, terms, privacy, etc.)' })
  get(@Param('slug') slug: string) {
    return this.pages.findPublicBySlug(slug)
  }
}

// ── Admin ────────────────────────────────────────────────────────────

@ApiTags('Admin — Content')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/content')
export class AdminContentPagesController {
  constructor(private readonly pages: ContentPagesService) {}

  @Get()
  @ApiOperation({ summary: 'List all content pages (published + draft)' })
  list() {
    return this.pages.listAll()
  }

  @Put()
  @ApiOperation({ summary: 'Create or update a content page (upsert by slug)' })
  upsert(@CurrentUser() user: JwtPayload, @Body() dto: UpsertContentPageDto) {
    return this.pages.upsert(user.sub, dto)
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a content page' })
  delete(@Param('slug') slug: string) {
    return this.pages.delete(slug)
  }
}
