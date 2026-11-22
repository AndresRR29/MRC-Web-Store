export interface Product {
  id: string
  name: string
  description: string
  category: string
  condition: string
  size: string
  color: string
  price: number
  images: string[]
  brand: string
  measurements: string
  material: string
  status: 'available' | 'reserved' | 'sold'
}

export interface MeetingPoint {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}
export interface Settings {
  storeName: string
  storeIntro?: string
  returnPolicy?: string
  phone: string
  whatsapp: string
  baseLatitude: number
  baseLongitude: number
  homeMinimum: number
  meetingPoints: MeetingPoint[]
  transferHours: number
  bankInstructions: string
}
export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'delivered' | 'cancelled' | 'expired'
export interface CheckoutInput {
  requestId: string
  productIds: string[]
  customerName: string
  phone: string
  delivery: 'meeting' | 'home'
  meetingPointId?: string
  address?: string
  latitude?: number
  longitude?: number
  payment: 'delivery' | 'transfer'
}
export interface OrderReceipt {
  id: string
  total: number
  payment: CheckoutInput['payment']
  bankInstructions: string
  expiresAt: string | null
}
export interface Order extends OrderReceipt {
  createdAt: string
  status: OrderStatus
  customerName: string
  phone: string
  delivery: CheckoutInput['delivery']
  address: string
  latitude: number
  longitude: number
  items: {id: string; name: string; price: number}[]
}
