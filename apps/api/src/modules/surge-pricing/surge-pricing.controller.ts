import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SurgePricingService } from './surge-pricing.service'
import { CreateSurgeRuleDto, UpdateSurgeRuleDto } from './dto/surge-rule.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

@ApiTags('Admin — Surge Pricing')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/surge-pricing')
export class SurgePricingController {
  constructor(private readonly service: SurgePricingService) {}

  @Get()
  @ApiOperation({ summary: 'List all surge rules' })
  list() {
    return this.service.listAll()
  }

  @Get('current-multiplier')
  @ApiOperation({ summary: 'Preview the multiplier that would apply right now' })
  async currentMultiplier() {
    return { multiplier: await this.service.getMultiplierAt(new Date()) }
  }

  @Post()
  @ApiOperation({ summary: 'Create a surge rule' })
  create(@Body() dto: CreateSurgeRuleDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a surge rule' })
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateSurgeRuleDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a surge rule' })
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.delete(id)
  }
}
