import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags,
  ApiConsumes,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiBody,
} from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import { UploadsService } from './uploads.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024   // 5 MB
const MAX_DOC_SIZE   = 10 * 1024 * 1024  // 10 MB

const imageMulter = { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE } }
const docMulter   = { storage: memoryStorage(), limits: { fileSize: MAX_DOC_SIZE } }

const fileUploadBody = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
}

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // ── Restaurant assets ────────────────────────────────────────────

  @Post('restaurant-logo')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload restaurant logo' })
  @ApiBody(fileUploadBody)
  @ApiOkResponse({ description: 'Cloudinary URL and publicId' })
  @UseInterceptors(FileInterceptor('file', imageMulter))
  async uploadRestaurantLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided')
    await this.uploadsService.validateAndScan(file, ALLOWED_IMAGE_TYPES)
    return this.uploadsService.uploadImage(file.buffer, 'restaurants/logos', `logo_${user.sub}`)
  }

  @Post('restaurant-cover')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload restaurant cover image' })
  @ApiBody(fileUploadBody)
  @UseInterceptors(FileInterceptor('file', imageMulter))
  async uploadRestaurantCover(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided')
    await this.uploadsService.validateAndScan(file, ALLOWED_IMAGE_TYPES)
    return this.uploadsService.uploadImage(file.buffer, 'restaurants/covers', `cover_${user.sub}`)
  }

  // ── Menu item photo ───────────────────────────────────────────────

  @Post('menu-item')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a menu item photo' })
  @ApiBody(fileUploadBody)
  @UseInterceptors(FileInterceptor('file', imageMulter))
  async uploadMenuItemPhoto(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided')
    await this.uploadsService.validateAndScan(file, ALLOWED_IMAGE_TYPES)
    return this.uploadsService.uploadImage(file.buffer, 'menu-items')
  }

  // ── User avatar ──────────────────────────────────────────────────

  @Post('avatar')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER, UserRole.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiBody(fileUploadBody)
  @UseInterceptors(FileInterceptor('file', imageMulter))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided')
    await this.uploadsService.validateAndScan(file, ALLOWED_IMAGE_TYPES)
    return this.uploadsService.uploadImage(file.buffer, 'avatars', `avatar_${user.sub}`)
  }

  // ── Rider KYC documents ──────────────────────────────────────────

  @Post('rider-document')
  @Roles(UserRole.RIDER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a rider KYC document (ID card, license, vehicle photo)' })
  @ApiBody(fileUploadBody)
  @UseInterceptors(FileInterceptor('file', docMulter))
  async uploadRiderDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided')
    await this.uploadsService.validateAndScan(file, ALLOWED_DOCUMENT_TYPES)
    return this.uploadsService.uploadDocument(file.buffer, 'rider-documents', `doc_${user.sub}_${Date.now()}`)
  }

  // ── Delivery proof photo (rider snaps at drop-off) ─────────────────

  @Post('delivery-proof')
  @Roles(UserRole.RIDER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a delivery proof photo (rider snaps at drop-off)' })
  @ApiBody(fileUploadBody)
  @UseInterceptors(FileInterceptor('file', imageMulter))
  async uploadDeliveryProof(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided')
    await this.uploadsService.validateAndScan(file, ALLOWED_IMAGE_TYPES)
    return this.uploadsService.uploadImage(file.buffer, 'delivery-proofs', `proof_${user.sub}_${Date.now()}`)
  }

  // ── Signed URL for private documents (admin / rider) ─────────────

  @Get('signed-url/:publicId')
  @Roles(UserRole.RIDER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a 15-minute signed URL for a private document' })
  @ApiOkResponse({ description: 'Signed Cloudinary URL' })
  getSignedUrl(@Param('publicId') publicId: string): { url: string } {
    return { url: this.uploadsService.getSignedUrl(publicId) }
  }
}
