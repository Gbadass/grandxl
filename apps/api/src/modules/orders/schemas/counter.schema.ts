import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

// Generic atomic counter — _id is the counter name string (e.g. 'order_seq')
@Schema({ collection: 'counters' })
export class CounterDocument extends Document {
  @Prop({ required: true, default: 0 })
  seq!: number
}

export const CounterSchema = SchemaFactory.createForClass(CounterDocument)

// Override _id from ObjectId (Mongoose default) to String so that
// findByIdAndUpdate('order_seq', ...) works without a cast error
CounterSchema.path('_id', String)
