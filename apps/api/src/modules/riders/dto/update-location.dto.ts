import { IsNumber, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateLocationDto {
  @ApiProperty({ example: 6.5244, description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  @ApiProperty({ example: 3.3792, description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number

  @ApiProperty({ example: 45, description: 'Bearing in degrees 0–359' })
  @IsNumber()
  @Min(0)
  @Max(359)
  bearing!: number
}
