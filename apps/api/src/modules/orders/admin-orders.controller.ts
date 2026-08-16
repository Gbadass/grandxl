import { Controller, Get, Delete, Param, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import { OrdersService } from './orders.service'
import { QueryOrdersDto } from './dto/query-orders.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

@ApiTags('Admin — Orders')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all orders (admin)' })
  @ApiOkResponse({ description: 'Paginated order list' })
  async getAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.getAdminOrders(query)
  }

  @Delete('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System-wide order clear — hides all orders from every view (soft-delete)' })
  @ApiOkResponse({ description: 'Number of orders cleared' })
  async clearAll() {
    return this.ordersService.clearAllOrders()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any order by ID (admin)' })
  @ApiOkResponse({ description: 'Order details' })
  async getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.ordersService.getOrderById(id)
  }
}
