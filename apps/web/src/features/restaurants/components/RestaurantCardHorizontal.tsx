import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, Clock } from 'lucide-react'
import type { Restaurant } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'

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

export function RestaurantCardHorizontal({ restaurant }: { restaurant: Restaurant }) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }}>
      <Link
        to={`/restaurants/${restaurant._id}`}
        className="block w-52 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Cover */}
        <div className="relative h-32 bg-gray-100 overflow-hidden">
          {restaurant.coverImage ? (
            <img
              src={restaurant.coverImage}
              alt={restaurant.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${nameToGradient(restaurant.name)}`}
            >
              <span className="font-display font-bold text-3xl text-white/90 select-none">
                {initials(restaurant.name)}
              </span>
            </div>
          )}

          {/* Rating pill */}
          {restaurant.ratingCount > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
              <Star size={10} className="text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-bold text-gray-900">{restaurant.rating.toFixed(1)}</span>
            </div>
          )}

          {/* Closed overlay */}
          {!restaurant.isOpen && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">
                Closed
              </span>
            </div>
          )}

          {/* Free delivery badge */}
          {restaurant.deliveryFeeFixed === 0 && restaurant.isOpen && (
            <div className="absolute bottom-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              FREE DELIVERY
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="font-semibold text-gray-900 text-sm truncate leading-tight">{restaurant.name}</h3>
          {restaurant.cuisine.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {restaurant.cuisine.join(' · ')}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
            <span className="flex items-center gap-0.5">
              <Clock size={10} />
              {restaurant.estimatedDeliveryTime} min
            </span>
            <span className="text-gray-300">·</span>
            <span>
              {restaurant.deliveryFeeFixed === 0
                ? <span className="text-green-600 font-semibold">Free</span>
                : formatMoney(restaurant.deliveryFeeFixed, restaurant.currency)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
