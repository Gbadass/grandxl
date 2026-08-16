'use client'

import { motion } from 'framer-motion'
import { OrderStatus } from '@grandxl/types'

interface Props {
  status: OrderStatus
  hasRider: boolean
}

type StepKey = 'confirmed' | 'preparing' | 'rider' | 'pickup' | 'delivered'

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'rider',     label: 'Rider'     },
  { key: 'pickup',    label: 'Pickup'    },
  { key: 'delivered', label: 'Delivered' },
]

/**
 * Pick the active step from order status + rider assignment.
 * - CONFIRMED, no rider  → "rider" step in-flight (searching)
 * - CONFIRMED, has rider → "rider" step in-flight (en route to restaurant)
 * - PREPARING            → "preparing" step in-flight, rider step done
 * - READY                → "pickup" step in-flight
 * - PICKED_UP            → "pickup" step done, "delivered" in-flight
 * - DELIVERED            → all done
 */
function deriveActiveStep(status: OrderStatus, hasRider: boolean): { active: StepKey; doneUpTo: StepKey } {
  if (status === OrderStatus.PENDING)   return { active: 'confirmed', doneUpTo: 'confirmed' }
  if (status === OrderStatus.CONFIRMED) return { active: hasRider ? 'rider' : 'rider', doneUpTo: 'confirmed' }
  if (status === OrderStatus.PREPARING) return { active: 'preparing', doneUpTo: 'rider' }
  if (status === OrderStatus.READY)     return { active: 'pickup', doneUpTo: 'preparing' }
  if (status === OrderStatus.PICKED_UP) return { active: 'delivered', doneUpTo: 'pickup' }
  if (status === OrderStatus.DELIVERED) return { active: 'delivered', doneUpTo: 'delivered' }
  return { active: 'confirmed', doneUpTo: 'confirmed' }
}

const ORDER: Record<StepKey, number> = {
  confirmed: 0, preparing: 1, rider: 2, pickup: 3, delivered: 4,
}

export function OrderLifecycleStrip({ status, hasRider }: Props) {
  const { active, doneUpTo } = deriveActiveStep(status, hasRider)
  const doneIdx   = ORDER[doneUpTo]
  const activeIdx = ORDER[active]

  return (
    <div className="relative flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isDone   = i <= doneIdx && i !== activeIdx
        const isActive = i === activeIdx && status !== OrderStatus.DELIVERED
        const isAllDone = status === OrderStatus.DELIVERED

        return (
          <div key={step.key} className="flex flex-1 items-center">
            {/* Node */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative flex h-6 w-6 items-center justify-center">
                {(isActive || isAllDone) && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-orange-400/40"
                    animate={isActive ? { scale: [1, 1.6, 1], opacity: [0.55, 0, 0.55] } : { scale: 1, opacity: 0 }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span className={[
                  'relative flex h-4 w-4 items-center justify-center rounded-full transition-colors',
                  isDone || isAllDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400',
                ].join(' ')}>
                  {(isDone || isAllDone) && (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-2.5 w-2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
              </div>
              <span className={[
                'text-[10px] font-semibold uppercase tracking-wider',
                isActive ? 'text-orange-600' : isDone || isAllDone ? 'text-emerald-700' : 'text-gray-400',
              ].join(' ')}>{step.label}</span>
            </div>

            {/* Connecting bar */}
            {i < STEPS.length - 1 && (
              <div className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <motion.div
                  className={i < doneIdx || isAllDone ? 'h-full w-full bg-emerald-500' : 'h-full bg-orange-400'}
                  initial={{ width: '0%' }}
                  animate={{ width: i < doneIdx || isAllDone ? '100%' : i === doneIdx && isActive ? '50%' : '0%' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
