import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
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
import { ReviewsService } from './reviews.service'
import { CreateReviewDto } from './dto/create-review.dto'
import { FlagReviewDto } from './dto/flag-review.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ── Customer — submit and view own reviews ───────────────────────

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a review for a delivered order' })
  @ApiCreatedResponse({ description: 'Review created' })
  async createReview(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(user.sub, dto)
  }

  @Get('my')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reviews submitted by the current customer' })
  @ApiOkResponse({ description: 'Paginated review list' })
  async getMyReviews(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getMyReviews(
      user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  // ── Customer — flag an inappropriate review ──────────────────────

  @Patch(':id/flag')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flag a review as inappropriate' })
  @ApiOkResponse({ description: 'Review flagged — queued for admin review' })
  async flagReview(
    @Param('id', ParseObjectIdPipe) reviewId: string,
    @Body() dto: FlagReviewDto,
  ) {
    return this.reviewsService.flagReview(reviewId, dto.reason)
  }

  // ── Public — restaurant reviews ──────────────────────────────────

  @Get('restaurant/:restaurantId')
  @Public()
  @ApiOperation({ summary: 'Get visible reviews for a restaurant' })
  @ApiOkResponse({ description: 'Paginated review list' })
  async getRestaurantReviews(
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getRestaurantReviews(
      restaurantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }
}
