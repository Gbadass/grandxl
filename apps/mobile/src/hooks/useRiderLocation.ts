import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { socket } from '../lib/socket'

export const RIDER_LOCATION_TASK = 'RIDER_LOCATION_TASK'

// Define the background task — must be called at module load time (top level)
TaskManager.defineTask(RIDER_LOCATION_TASK, ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) return

  const { locations } = data as { locations: Location.LocationObject[] }
  const location = locations[0]
  if (!location) return

  const { latitude, longitude, heading } = location.coords

  socket.emit('rider:location_update', {
    lat: latitude,
    lng: longitude,
    bearing: heading ?? 0,
  })
})

export async function startRiderLocationTracking(): Promise<void> {
  try {
    // First request foreground permission (required before background on Android 11+)
    const { status: fg } = await Location.requestForegroundPermissionsAsync()
    if (fg !== 'granted') return

    const { status: bg } = await Location.requestBackgroundPermissionsAsync()
    if (bg !== 'granted') return

    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK)
    if (alreadyRunning) return

    await Location.startLocationUpdatesAsync(RIDER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      foregroundService: {
        notificationTitle: 'GrandXL Delivery Active',
        notificationBody: 'Tracking your location for delivery.',
        notificationColor: '#E84B3A',
      },
    })
  } catch {
    // Permission denied or location unavailable — fail silently, rider still sees jobs
  }
}

export async function stopRiderLocationTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK)
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK)
  }
}
