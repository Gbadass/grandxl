import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UpsertContentPageDto {
  @ApiProperty({ example: 'faq', description: 'URL-safe slug' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be lowercase kebab-case' })
  slug!: string

  @ApiProperty({ example: 'Frequently Asked Questions' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string

  @ApiProperty({ example: '# FAQ\n\n## How do I ...' })
  @IsString()
  @MinLength(1)
  @MaxLength(50_000)
  body!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean
}
