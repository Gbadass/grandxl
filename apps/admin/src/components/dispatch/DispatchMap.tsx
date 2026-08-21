'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Order } from '@grandxl/types'

export interface RiderPin {
  riderId: string
  orderId: string
  lat: number
  lng: number
  bearing: number
  updatedAt: number
}

// Fix Leaflet's default icon paths broken by bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Rider icon — orange circle with arrow (CSS-only, no external image)
function makeRiderIcon(bearing: number) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:#EA580C;border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
        transform:rotate(${bearing}deg);
      ">
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white' width='16' height='16'>
          <path d='M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z'/>
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// Destination pin — indigo
const destinationIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      background:#4F46E5;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
      transform:rotate(-45deg);
    "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
})

// Restaurant pin — green
const restaurantIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:26px;height:26px;border-radius:50% 50% 50% 0;
      background:#16A34A;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
      transform:rotate(-45deg);
    "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -28],
})

// Re-centre map when selection changes
function MapCenterer({ orders, selectedOrderId, riderPins }: {
  orders: Order[]
  selectedOrderId: string | null
  riderPins: RiderPin[]
}) {
  const map = useMap()

  useEffect(() => {
    if (!selectedOrderId) return
    const pin = riderPins.find((p) => p.orderId === selectedOrderId)
    if (pin) {
      map.setView([pin.lat, pin.lng], 14, { animate: true })
      return
    }
    const order = orders.find((o) => o._id === selectedOrderId)
    const coords = order?.deliveryAddress?.coordinates?.coordinates
    if (coords) {
      map.setView([coords[1], coords[0]], 13, { animate: true })
    }
  }, [selectedOrderId, map, orders, riderPins])

  return null
}

interface Props {
  orders: Order[]
  riderPins: RiderPin[]
  selectedOrderId: string | null
  onOrderSelect: (id: string | null) => void
}

// Default centre on Lagos, Nigeria
const LAGOS: [number, number] = [6.5244, 3.3792]

export default function DispatchMap({ orders, riderPins, selectedOrderId, onOrderSelect }: Props) {
  return (
    <MapContainer
      center={LAGOS}
      zoom={12}
      className="h-full w-full"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapCenterer
        orders={orders}
        selectedOrderId={selectedOrderId}
        riderPins={riderPins}
      />

      {/* Restaurant pickup pins */}
      {orders.map((order) => {
        const coords = order.restaurantPickupAddress?.coordinates?.coordinates
        if (!coords) return null
        return (
          <Marker
            key={`rest-${order._id}`}
            position={[coords[1], coords[0]]}
            icon={restaurantIcon}
            eventHandlers={{ click: () => onOrderSelect(order._id) }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">{order.orderNumber}</p>
                <p className="text-gray-500">Pickup point</p>
                <p className="capitalize mt-0.5 text-orange-600 font-medium">{order.status.replace('_', ' ')}</p>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* Delivery destination pins */}
      {orders.map((order) => {
        const coords = order.deliveryAddress?.coordinates?.coordinates
        if (!coords) return null
        return (
          <Marker
            key={`dest-${order._id}`}
            position={[coords[1], coords[0]]}
            icon={destinationIcon}
            eventHandlers={{ click: () => onOrderSelect(order._id) }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">{order.orderNumber}</p>
                <p className="text-gray-500">{order.deliveryAddress.street}</p>
                <p className="text-gray-500">{order.deliveryAddress.city}</p>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* Live rider pins */}
      {riderPins.map((pin) => (
        <Marker
          key={pin.riderId}
          position={[pin.lat, pin.lng]}
          icon={makeRiderIcon(pin.bearing)}
          eventHandlers={{ click: () => onOrderSelect(pin.orderId) }}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-semibold text-orange-600">Rider — live</p>
              <p className="text-gray-500">
                {orders.find((o) => o._id === pin.orderId)?.orderNumber ?? pin.orderId.slice(-6)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
