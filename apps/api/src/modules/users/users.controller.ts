import {
  Controller,
  Get,
  Patch,
  Post,
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
import { UsersService } from './users.service'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { AddAddressDto } from './dto/add-address.dto'
import { UpdateAddressDto } from './dto/update-address.dto'
import { UpdatePushTokenDto } from './dto/update-push-token.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { DataExportService } from '../data-export/data-export.service'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly dataExport:   DataExportService,
  ) {}

  // ── Profile ─────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get my profile' })
  @ApiOkResponse({ description: 'User profile returned' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    const doc = await this.usersService.findByIdOrThrow(user.sub)
    return this.usersService.toSafeUser(doc)
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update my profile' })
  @ApiOkResponse({ description: 'Profile updated' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const doc = await this.usersService.updateProfile(user.sub, dto)
    return this.usersService.toSafeUser(doc)
  }

  // ── Addresses ────────────────────────────────────────────────────

  @Get('me/addresses')
  @ApiOperation({ summary: 'List saved delivery addresses' })
  @ApiOkResponse({ description: 'Array of addresses' })
  async getAddresses(@CurrentUser() user: JwtPayload) {
    const doc = await this.usersService.findByIdOrThrow(user.sub)
    return doc.addresses
  }

  @Post('me/addresses')
  @ApiOperation({ summary: 'Add a delivery address' })
  @ApiCreatedResponse({ description: 'Address added. Returns updated user profile.' })
  async addAddress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddAddressDto,
  ) {
    const doc = await this.usersService.addAddress(user.sub, dto)
    return this.usersService.toSafeUser(doc)
  }

  @Patch('me/addresses/:id')
  @ApiOperation({ summary: 'Update a delivery address' })
  @ApiOkResponse({ description: 'Address updated. Returns updated user profile.' })
  async updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const doc = await this.usersService.updateAddress(user.sub, addressId, dto)
    return this.usersService.toSafeUser(doc)
  }

  @Delete('me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a delivery address' })
  @ApiNoContentResponse({ description: 'Address deleted' })
  async deleteAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) addressId: string,
  ) {
    await this.usersService.deleteAddress(user.sub, addressId)
  }

  @Patch('me/addresses/:id/default')
  @ApiOperation({ summary: 'Set a delivery address as default' })
  @ApiOkResponse({ description: 'Default address updated. Returns updated user profile.' })
  async setDefaultAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) addressId: string,
  ) {
    const doc = await this.usersService.setDefaultAddress(user.sub, addressId)
    return this.usersService.toSafeUser(doc)
  }

  // ── Favorites ────────────────────────────────────────────────────

  @Get('me/favorites')
  @ApiOperation({ summary: 'List my favorited restaurant IDs' })
  async listFavorites(@CurrentUser() user: JwtPayload) {
    return this.usersService.listFavoriteIds(user.sub)
  }

  @Post('me/favorites/:restaurantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Favorite a restaurant' })
  async addFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
  ) {
    await this.usersService.addFavorite(user.sub, restaurantId)
  }

  @Delete('me/favorites/:restaurantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfavorite a restaurant' })
  async removeFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('restaurantId', ParseObjectIdPipe) restaurantId: string,
  ) {
    await this.usersService.removeFavorite(user.sub, restaurantId)
  }

  // ── Push tokens ──────────────────────────────────────────────────

  @Patch('me/push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register Expo push notification token' })
  @ApiNoContentResponse({ description: 'Push token saved' })
  async updatePushToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePushTokenDto,
  ) {
    await this.usersService.updateExpoPushToken(user.sub, dto.expoPushToken)
  }

  @Post('me/web-push-subscription')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Save a Web Push (VAPID) subscription for this browser' })
  @ApiNoContentResponse({ description: 'Subscription saved' })
  async saveWebPushSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.usersService.saveWebPushSubscription(user.sub, body)
  }

  @Delete('me/web-push-subscription')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a Web Push subscription (unsubscribe)' })
  @ApiNoContentResponse({ description: 'Subscription removed' })
  async removeWebPushSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() body: { endpoint: string },
  ) {
    await this.usersService.removeWebPushSubscription(user.sub, body.endpoint)
  }

  // ── NDPR — Part 31 ───────────────────────────────────────────────

  @Get('me/data-export')
  @ApiOperation({ summary: 'Export all my personal data (NDPR right of access)' })
  @ApiOkResponse({ description: 'Full user data export returned' })
  async exportData(@CurrentUser() user: JwtPayload) {
    return this.dataExport.exportForUser(user.sub)
  }

  @Delete('me/account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my account — anonymises personal data (NDPR right to erasure)' })
  @ApiNoContentResponse({ description: 'Account anonymised' })
  async deleteAccount(@CurrentUser() user: JwtPayload) {
    await this.usersService.softDeleteAccount(user.sub)
  }
}
