import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'
import { UserRole } from '@grandxl/types'

export class VerifyAndAddRoleDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiProperty({ example: 'Sup3rSecret!' })
  @IsString()
  @MinLength(6)
  password!: string

  @ApiProperty({ enum: [UserRole.RIDER, UserRole.RESTAURANT_OWNER] })
  @IsEnum([UserRole.RIDER, UserRole.RESTAURANT_OWNER])
  role!: UserRole.RIDER | UserRole.RESTAURANT_OWNER
}
