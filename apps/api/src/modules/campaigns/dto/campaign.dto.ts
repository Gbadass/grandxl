import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CampaignAudience } from '../schemas/campaign.schema'

export class CreateCampaignDto {
  @ApiProperty({ example: 'Free delivery tonight!' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string

  @ApiProperty({ example: 'Order before 10pm to skip the delivery fee.' })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  body!: string

  @ApiPropertyOptional({ example: 'grandxl://restaurants' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string

  @ApiProperty({ enum: CampaignAudience })
  @IsEnum(CampaignAudience)
  audience!: CampaignAudience
}
