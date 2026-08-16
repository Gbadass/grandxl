import { IsOptional, IsString, IsUrl } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateDocumentsDto {
  @ApiPropertyOptional({ description: 'Cloudinary URL of uploaded ID card' })
  @IsOptional()
  @IsString()
  @IsUrl()
  idCard?: string

  @ApiPropertyOptional({ description: 'Cloudinary URL of uploaded driver license' })
  @IsOptional()
  @IsString()
  @IsUrl()
  driverLicense?: string

  @ApiPropertyOptional({ description: 'Cloudinary URL of uploaded vehicle photo' })
  @IsOptional()
  @IsString()
  @IsUrl()
  vehiclePhoto?: string
}
