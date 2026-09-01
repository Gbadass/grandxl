// Delivery zone — a Mongo-backed GeoJSON polygon defining where the platform
// delivers. Stored server-side with a 2dsphere index for point-in-polygon
// lookups on customer addresses.

export interface DeliveryZonePolygon {
  type: 'Polygon'
  // GeoJSON: outer ring first, then holes. Each ring is an array of [lng, lat]
  // pairs with the last pair equal to the first (closed ring).
  coordinates: number[][][]
}

export interface DeliveryZone {
  _id: string
  name: string
  city: string
  polygon: DeliveryZonePolygon
  // Multiplier on the restaurant's base delivery fee. 1.0 = unchanged;
  // higher for far zones, lower for promo zones.
  deliveryFeeMultiplier: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
