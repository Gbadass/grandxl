import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { DeliveryZonesService } from './delivery-zones.service'
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

@ApiTags('Admin — Delivery Zones')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/delivery-zones')
export class DeliveryZonesController {
  constructor(private readonly zones: DeliveryZonesService) {}

  @Get()
  @ApiOperation({ summary: 'List all delivery zones' })
  list() {
    return this.zones.listAll()
  }

  @Post()
  @ApiOperation({ summary: 'Create a delivery zone' })
  create(@Body() dto: CreateDeliveryZoneDto) {
    return this.zones.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a delivery zone' })
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateDeliveryZoneDto) {
    return this.zones.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a delivery zone' })
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.zones.delete(id)
  }
}
