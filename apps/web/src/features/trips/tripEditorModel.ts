import type {
  BookingStatus,
  FoodStatus,
  ItineraryType,
  TransportMethod,
  TripBudgetCategory,
  TripChecklistGroup,
  TripChecklistItem,
  TripFoodItem,
  TripItineraryDay,
  TripItineraryItem,
  TripStayItem,
  TripTransportItem,
} from '../../data/models/types'
import { createId } from '../../shared/utils/ids'

export const tripStatusOptions = ['Planning', 'Booked', 'Ready', 'Ongoing', 'Done'] as const
export const bookingStatusOptions: BookingStatus[] = ['Pending', 'Confirmed', 'Not booked']
export const foodStatusOptions: FoodStatus[] = ['Saved', 'Planned', 'Visited']
export const itineraryTypeOptions: ItineraryType[] = ['spot', 'food', 'transport', 'hotel']
export const transportMethodOptions: TransportMethod[] = ['Flight', 'Train', 'Bus', 'Taxi', 'Subway', 'Walk', 'Car']
export const transportCategoryOptions = ['intercity', 'local'] as const
export const priceRangeOptions: TripFoodItem['priceRange'][] = ['¥', '¥¥', '¥¥¥']

export const createItineraryItem = (): TripItineraryItem => ({
  id: createId(),
  title: '',
  time: '',
  location: '',
  type: 'spot',
  notes: '',
})

export const createItineraryDay = (day: number): TripItineraryDay => ({
  day,
  date: '',
  label: `Day ${day}`,
  items: [createItineraryItem()],
})

export const createTransportItem = (): TripTransportItem => ({
  id: createId(),
  category: 'intercity',
  method: 'Flight',
  from: '',
  to: '',
  departTime: '',
  arriveTime: '',
  date: '',
  status: 'Pending',
  cost: 0,
  currency: 'USD',
  notes: '',
})

export const createStayItem = (): TripStayItem => ({
  id: createId(),
  name: '',
  address: '',
  checkIn: '',
  checkOut: '',
  nights: 1,
  status: 'Pending',
  cost: 0,
  currency: 'USD',
  notes: '',
})

export const createFoodItem = (): TripFoodItem => ({
  id: createId(),
  name: '',
  area: '',
  cuisine: '',
  status: 'Saved',
  priceRange: '¥¥',
  notes: '',
})

export const createBudgetItem = (): TripBudgetCategory => ({
  id: createId(),
  label: '',
  emoji: '💸',
  planned: 0,
  actual: 0,
})

export const createChecklistItem = (): TripChecklistItem => ({
  id: createId(),
  label: '',
  done: false,
})

export const createChecklistGroup = (): TripChecklistGroup => ({
  id: createId(),
  label: 'New group',
  emoji: '📝',
  items: [createChecklistItem()],
})
