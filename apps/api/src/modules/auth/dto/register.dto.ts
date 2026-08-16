import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
  Matches,
  IsNotEmpty,
} from 'class-validator'
import { Transform } from 'class-transformer'
import { UserRole } from '@grandxl/types'

export class RegisterDto {
  @ApiProperty({ example: 'Tunde' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string

  @ApiProperty({ example: 'Adeyemi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => {
    if (value?.startsWith('+')) return value
    if (value?.startsWith('0') && value.length === 11) return `+234${value.slice(1)}`
    return value
  })
  phone!: string

  @ApiPropertyOptional({ example: 'tunde@example.com' })
  @IsEmail()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email?: string

  @ApiProperty({ example: 'SecurePass1' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password!: string

  @ApiPropertyOptional({ default: 'NG' })
  @IsString()
  @IsOptional()
  country?: string = 'NG'

  @ApiProperty({ example: true })
  @IsBoolean()
  consentGiven!: boolean

  @ApiPropertyOptional({ enum: [UserRole.CUSTOMER, UserRole.RIDER, UserRole.RESTAURANT_OWNER], default: UserRole.CUSTOMER })
  @IsOptional()
  @IsEnum([UserRole.CUSTOMER, UserRole.RIDER, UserRole.RESTAURANT_OWNER])
  role?: UserRole.CUSTOMER | UserRole.RIDER | UserRole.RESTAURANT_OWNER
}
