import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty } from 'class-validator'
import { Transform } from 'class-transformer'

export class SendOtpDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => {
    if (value?.startsWith('+')) return value
    if (value?.startsWith('0') && value.length === 11) return `+234${value.slice(1)}`
    return value
  })
  phone!: string
}
