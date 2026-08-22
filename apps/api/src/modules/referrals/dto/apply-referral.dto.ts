import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty, Length } from 'class-validator'
import { Transform } from 'class-transformer'

export class ApplyReferralDto {
  @ApiProperty({ example: 'ABC12XYZ' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 12)
  @Transform(({ value }: { value: string }) => value?.toUpperCase()?.trim())
  code!: string
}
