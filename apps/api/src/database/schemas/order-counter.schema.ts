import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type OrderCounterDocument = HydratedDocument<OrderCounter>

@Schema({ timestamps: false, collection: 'order_counters' })
export class OrderCounter {
  @Prop({ required: true, unique: true, index: true })
  date!: string // 'YYYY-MM-DD' format

  @Prop({ required: true, default: 0 })
  sequence!: number
}

export const OrderCounterSchema = SchemaFactory.createForClass(OrderCounter)
