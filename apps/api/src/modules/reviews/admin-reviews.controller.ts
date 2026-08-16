import { Controller, Get, Patch, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { ReviewsService } from './reviews.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

class SetVisibilityDto {
  @ApiProperty({ example: false, description: 'false = hide the review from public view' })
  @IsBoolean()
  isVisible!: boolean
}

@ApiTags('Admin — Reviews')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('flagged')
  @ApiOperation({ summary: 'List all flagged reviews awaiting moderation' })
  @ApiOkResponse({ description: 'Flagged review list' })
  async getFlaggedReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getFlaggedReviews(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  @Patch(':id/visibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Show or hide a review (admin moderation)' })
  @ApiOkResponse({ description: 'Review updated' })
  async setVisibility(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetVisibilityDto,
  ) {
    return this.reviewsService.setVisibility(id, dto.isVisible)
  }
}
