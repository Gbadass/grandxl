import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DeliveryZoneDocument } from './schemas/delivery-zone.schema'
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto'

@Injectable()
export class DeliveryZonesService {
  constructor(
    @InjectModel(DeliveryZoneDocument.name)
    private readonly zoneModel: Model<DeliveryZoneDocument>,
  ) {}

  async listAll(): Promise<DeliveryZoneDocument[]> {
    return this.zoneModel.find().sort({ name: 1 }).lean() as unknown as DeliveryZoneDocument[]
  }

  async create(dto: CreateDeliveryZoneDto): Promise<DeliveryZoneDocument> {
    this.assertClosedPolygon(dto.coordinates)
    return this.zoneModel.create({
      name:                  dto.name,
      city:                  dto.city ?? '',
      polygon:               { type: 'Polygon', coordinates: [dto.coordinates] },
      deliveryFeeMultiplier: dto.deliveryFeeMultiplier ?? 1.0,
      isActive:              dto.isActive ?? true,
    })
  }

  async update(id: string, dto: UpdateDeliveryZoneDto): Promise<DeliveryZoneDocument> {
    const updates: Record<string, unknown> = { ...dto }
    if (dto.coordinates) {
      this.assertClosedPolygon(dto.coordinates)
      updates.polygon = { type: 'Polygon', coordinates: [dto.coordinates] }
      delete (updates as { coordinates?: unknown }).coordinates
    }
    const zone = await this.zoneModel.findByIdAndUpdate(id, { $set: updates }, { new: true })
    if (!zone) throw new NotFoundException('Delivery zone not found')
    return zone
  }

  async delete(id: string): Promise<void> {
    const zone = await this.zoneModel.findByIdAndDelete(id)
    if (!zone) throw new NotFoundException('Delivery zone not found')
  }

  // Find any active zone containing the point (lng, lat). Returns the first hit —
  // if zones overlap we don't care which wins because the multipliers should match.
  async findZoneForPoint(lat: number, lng: number): Promise<DeliveryZoneDocument | null> {
    return this.zoneModel.findOne({
      isActive: true,
      polygon: {
        $geoIntersects: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
        },
      },
    }).lean() as unknown as DeliveryZoneDocument | null
  }

  private assertClosedPolygon(coords: [number, number][]): void {
    if (coords.length < 4) {
      throw new BadRequestException('Polygon requires at least 4 points including closing point')
    }
    const first = coords[0]
    const last  = coords[coords.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new BadRequestException('First and last polygon points must be identical (closed ring)')
    }
  }
}
