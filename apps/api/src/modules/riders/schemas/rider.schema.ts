import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { VehicleType } from '@grandxl/types'

@Schema({ _id: false })
class LocationSubdoc {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type!: string

  @Prop({ type: [Number], default: () => [0, 0] })
  coordinates!: [number, number]

  @Prop({ type: Number, default: 0 })
  bearing!: number

  @Prop({ type: Date, default: null })
  updatedAt!: Date | null
}

@Schema({ _id: false })
class EarningsSubdoc {
  @Prop({ type: Number, default: 0 })
  totalKobo!: number

  @Prop({ type: Number, default: 0 })
  pendingKobo!: number
}

@Schema({ _id: false })
class DocumentsSubdoc {
  @Prop({ type: String, default: null })
  idCard!: string | null

  @Prop({ type: String, default: null })
  driverLicense!: string | null

  @Prop({ type: String, default: null })
  vehiclePhoto!: string | null
}

@Schema({ _id: false })
class BankAccountSubdoc {
  @Prop({ type: String, default: null })
  bankName!: string | null

  @Prop({ type: String, default: null })
  accountNumber!: string | null

  @Prop({ type: String, default: null })
  accountName!: string | null

  @Prop({ type: String, default: null })
  bankCode!: string | null

  // Paystack recipient code created when rider saves bank account.
  // Required to initiate a transfer — stored so we don't re-create on every payout.
  @Prop({ type: String, default: null })
  paystackRecipientCode!: string | null
}

const LocationSchema     = SchemaFactory.createForClass(LocationSubdoc)
const EarningsSchema     = SchemaFactory.createForClass(EarningsSubdoc)
const DocumentsSchema    = SchemaFactory.createForClass(DocumentsSubdoc)
const BankAccountSchema  = SchemaFactory.createForClass(BankAccountSubdoc)

@Schema({ timestamps: true, collection: 'riders' })
export class RiderDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  userId!: Types.ObjectId

  @Prop({ type: String, enum: Object.values(VehicleType), required: true })
  vehicleType!: VehicleType

  @Prop({ type: String, default: null })
  vehiclePlate!: string | null

  @Prop({ default: false })
  isVerified!: boolean

  @Prop({ default: false })
  isOnline!: boolean

  @Prop({ default: true })
  isAvailable!: boolean

  @Prop({
    type: LocationSchema,
    default: () => ({ type: 'Point', coordinates: [0, 0], bearing: 0, updatedAt: null }),
  })
  currentLocation!: LocationSubdoc

  @Prop({ default: 0, min: 0, max: 5 })
  rating!: number

  @Prop({ default: 0 })
  ratingCount!: number

  @Prop({ default: 0 })
  totalDeliveries!: number

  @Prop({
    type: EarningsSchema,
    default: () => ({ totalKobo: 0, pendingKobo: 0 }),
  })
  earnings!: EarningsSubdoc

  @Prop({
    type: DocumentsSchema,
    default: () => ({ idCard: null, driverLicense: null, vehiclePhoto: null }),
  })
  documents!: DocumentsSubdoc

  // Where payouts land. Set by the rider; admin verifies on first payout.
  @Prop({
    type: BankAccountSchema,
    default: () => ({ bankName: null, accountNumber: null, accountName: null, bankCode: null }),
  })
  bankAccount!: BankAccountSubdoc

  createdAt!: Date
  updatedAt!: Date
}

export const RiderSchema = SchemaFactory.createForClass(RiderDocument)

RiderSchema.index({ userId: 1 }, { unique: true })
RiderSchema.index({ isOnline: 1, isAvailable: 1, isVerified: 1 })
RiderSchema.index({ currentLocation: '2dsphere' })
