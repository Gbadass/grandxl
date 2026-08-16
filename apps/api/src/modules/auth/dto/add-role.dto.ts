import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { UserRole } from '@grandxl/types'

export class AddRoleDto {
  @ApiProperty({ enum: [UserRole.RIDER, UserRole.RESTAURANT_OWNER] })
  @IsEnum([UserRole.RIDER, UserRole.RESTAURANT_OWNER])
  role!: UserRole.RIDER | UserRole.RESTAURANT_OWNER
}
