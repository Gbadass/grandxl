import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, Clock } from 'lucide-react'
import type { Restaurant } from '@grandxl/types'
import { formatMoney, isRestaurantOpen } from '@grandxl/utils'
import type { RestaurantHours } from '@grandxl/utils'

interface Props {
  restaurant: Restaurant
}

const GRADIENTS = [
  'from-orange-400 to-red-500',
  'from-violet-500 to-purple-600',
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-pink-400 to-rose-600',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-sky-500',
  'from-lime-400 to-green-600',
]

function nameToGradient(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function RestaurantCard({ restaurant }: Props) {
  const isFree = restaurant.deliveryFeeFixed === 0
  // Closed if manually toggled off, OR if outside today's opening hours schedule
  const isOpen = restaurant.isOpen && isRestaurantOpen(restaurant.openingHours as unknown as RestaurantHours)

  return (
    <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.15 }}>
      <Link
        to={`/restaurants/${restaurant._id}`}
        className="group block rounded-2xl bg-white shadow-sm hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Cover */}
        <div className="relative h-44 bg-gray-100 overflow-hidden">
          {restaurant.coverImage ? (
            <img
              src={restaurant.coverImage}
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-400"
              loading="lazy"
            />
          ) : (
            <div
              className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${nameToGradient(restaurant.name)}`}
            >
              <span className="font-display font-bold text-5xl text-white/90 drop-shadow-sm select-none">
                {initials(restaurant.name)}
              </span>
            </div>
          )}

          {/* Scrim for text legibility */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
            {/* Closed badge */}
            {!isOpen ? (
              <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                CLOSED
              </div>
            ) : isOpen && isFree ? (
              <div className="bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                FREE DELIVERY
              </div>
            ) : (
              <div />
            )}

            {/* Rating pill */}
            {restaurant.ratingCount > 0 && (
              <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-[11px] font-bold text-gray-900">{restaurant.rating.toFixed(1)}</span>
                <span className="text-[10px] text-gray-400">({restaurant.ratingCount})</span>
              </div>
            )}
          </div>

          {/* Bottom: delivery time overlay */}
          <div className="absolute bottom-2.5 left-3 flex items-center gap-1">
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
              <Clock size={10} className="text-white/80" />
              <span className="text-[10px] font-semibold text-white">
                {restaurant.estimatedDeliveryTime} min
              </span>
            </div>
          </div>

          {/* Logo */}
          {restaurant.logo && (
            <div className="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-white shadow-md overflow-hidden border border-white">
              <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 pb-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm truncate leading-tight">
                {restaurant.name}
              </h3>
              {restaurant.cuisine.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {restaurant.cuisine.join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* Delivery fee row */}
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className={isFree ? 'font-semibold text-green-600' : 'text-gray-500'}>
              {isFree ? 'Free delivery' : `${formatMoney(restaurant.deliveryFeeFixed, restaurant.currency)} delivery`}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
