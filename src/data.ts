import { createClient } from '@supabase/supabase-js'
import { seedProducts } from './seed'
import type { CheckoutInput, Order, OrderReceipt, OrderStatus, Product, Settings } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const client = url && key ? createClient(url, key) : null
export const demoMode = !url && !key
const stateKey = 'ropa.demo.v1'
const adminKey = 'ropa.demo.admin'
const initialSettings: Settings = {
  storeName: 'Otra Vuelta', phone: '', whatsapp: '',
  baseLatitude: 19.4326, baseLongitude: -99.1332, homeMinimum: 500, transferHours: 24,
  meetingPoints: [
    { id: 'alameda', name: 'Alameda Central', address: 'Entrada por Av. Juárez, Centro, CDMX', latitude: 19.4352, longitude: -99.144 },
    { id: 'bellas-artes', name: 'Bellas Artes', address: 'Explanada principal, Centro, CDMX', latitude: 19.4352, longitude: -99.1412 },
  ],
  bankInstructions: 'Pedido de demostración. No envíes dinero.',
}

function db() {
  if (!client) throw new Error('Falta completar la configuración de la tienda.')
  return client
}
interface DemoState {
  products: Product[]
  orders: (Order & { requestId: string })[]
  settings: Settings
}
function loadDemo(): DemoState {
  const saved = localStorage.getItem(stateKey)
  const state: DemoState = saved ? JSON.parse(saved) : {
    products: structuredClone(seedProducts), orders: [], settings: structuredClone(initialSettings),
  }
  for (const order of state.orders) {
    if (order.status === 'awaiting_payment' && order.expiresAt && Date.parse(order.expiresAt) <= Date.now()) {
      order.status = 'expired'
      for (const product of state.products) {
        if (order.items.some(item => item.id === product.id)) product.status = 'available'
      }
    }
  }
  return state
}
async function changeDemo<T>(change: (state: DemoState) => T): Promise<T> {
  const apply = () => {
    const state = loadDemo()
    const result = change(state)
    try { localStorage.setItem(stateKey, JSON.stringify(state)) }
    catch { throw new Error('No se pudo guardar la demostración. Revisa el espacio disponible en tu navegador.') }
    return result
  }
  return navigator.locks ? navigator.locks.request(stateKey, apply) : apply()
}
function assertDemoAdmin() {
  if (!sessionStorage.getItem(adminKey)) throw new Error('Inicia sesión para administrar la tienda.')
}
function check(error: { message: string; code?: string } | null) {
  if (!error) return
  throw new Error(error.code === 'P0001' ? error.message : 'No pudimos completar la operación. Revisa tu conexión e inténtalo de nuevo.')
}
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180
  const h = Math.sin((lat2-lat1)*rad/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2
  return 12742 * Math.asin(Math.sqrt(Math.min(1,h)))
}
export async function getProducts(): Promise<Product[]> {
  if (demoMode) return loadDemo().products
  check((await db().rpc('expire_store_orders')).error)
  const {data,error} = await db().from('products').select('*').order('created_at',{ascending:false})
  check(error)
  return data as Product[]
}
export async function getSettings(): Promise<Settings> {
  if (demoMode) return loadDemo().settings
  const {data,error} = await db().rpc('read_store_settings')
  check(error)
  return data as Settings
}
export async function saveSettings(settings: Settings): Promise<void> {
  if (!settings.storeName.trim() || !Number.isFinite(settings.homeMinimum) || settings.homeMinimum < 0 ||
      !Number.isInteger(settings.transferHours) || settings.transferHours < 1 ||
      !Number.isFinite(settings.baseLatitude) || Math.abs(settings.baseLatitude)>90 ||
      !Number.isFinite(settings.baseLongitude) || Math.abs(settings.baseLongitude)>180) {
    throw new Error('Revisa el nombre, el mínimo de compra, las coordenadas y el plazo de pago.')
  }
  if (settings.meetingPoints.some(p => !p.name.trim() || !p.address.trim() ||
    !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude)>90 || Math.abs(p.longitude)>180 ||
    distanceKm(settings.baseLatitude,settings.baseLongitude,p.latitude,p.longitude)>5)) {
    throw new Error('Cada punto debe tener nombre, dirección y estar a un máximo de 5 km de tu base.')
  }
  if (demoMode) {
    assertDemoAdmin()
    await changeDemo(state => { state.settings = settings })
    return
  }
  const {error} = await db().from('store_settings').update({data:settings}).eq('id',true).select('id').single()
  check(error)
}
export async function saveProduct(product: Product): Promise<void> {
  if (!product.name.trim() || product.price<=0 || !Number.isFinite(product.price) || !product.images.length) {
    throw new Error('Agrega nombre, precio y al menos una foto.')
  }
  if (demoMode) {
    assertDemoAdmin()
    await changeDemo(state => {
      const old = state.products.find(p => p.id === product.id)
      if ((old?.status === 'reserved') !== (product.status === 'reserved')) {
        throw new Error('La disponibilidad cambió. Actualiza el catálogo antes de editar.')
      }
      if (old) Object.assign(old,product)
      else state.products.unshift(product)
    })
    return
  }
  check((await db().rpc('save_store_product',{product})).error)
}
export async function uploadImage(file: File): Promise<string> {
  const types: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
  if (!types[file.type] || file.size>5*1024*1024) throw new Error('Sube una foto JPG, PNG o WebP de hasta 5 MB.')
  if (demoMode) {
    assertDemoAdmin()
    return new Promise((resolve,reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      reader.readAsDataURL(file)
    })
  }
  const path = crypto.randomUUID()+'.'+types[file.type]
  const storage = db().storage.from('product-images')
  check((await storage.upload(path,file)).error)
  return storage.getPublicUrl(path).data.publicUrl
}
export async function isAdmin(): Promise<boolean> {
  if (demoMode) return !!sessionStorage.getItem(adminKey)
  const {data,error} = await db().rpc('is_store_admin')
  check(error)
  return data === true
}
export async function signIn(email: string, password: string): Promise<void> {
  if (demoMode) { sessionStorage.setItem(adminKey,'1'); return }
  const {error} = await db().auth.signInWithPassword({email,password})
  if (error) throw new Error('No se pudo iniciar sesión. Verifica tu correo y contraseña.')
  if (!await isAdmin()) {
    await signOut()
    throw new Error('Esta cuenta no tiene acceso de administración.')
  }
}
export async function signOut(): Promise<void> {
  if (demoMode) { sessionStorage.removeItem(adminKey); return }
  check((await db().auth.signOut()).error)
}

export async function submitOrder(input: CheckoutInput): Promise<OrderReceipt> {
  if (!demoMode) {
    const {data,error} = await db().rpc('place_store_order',{input})
    check(error)
    return data as OrderReceipt
  }
  return changeDemo(state => {
    const existing = state.orders.find(o => o.requestId === input.requestId)
    if (existing) return existing
    const {settings} = state
    if (input.customerName.trim().length<2 || !/^\d{10,15}$/.test(input.phone.replace(/\D/g,''))) {
      throw new Error('Revisa tu nombre y teléfono.')
    }
    const items = input.productIds.map(id => {
      const product = state.products.find(p => p.id === id && p.status === 'available')
      if (!product) throw new Error('Una prenda ya no está disponible. Revisa tu bolsa.')
      return {id,name:product.name,price:product.price}
    })
    if (!items.length || new Set(input.productIds).size !== items.length) throw new Error('Revisa tu bolsa.')
    const total = Math.round(items.reduce((sum,item) => sum+item.price,0)*100)/100
    const point = settings.meetingPoints.find(p => p.id===input.meetingPointId)
    const home = input.delivery === 'home'
    const latitude = home ? input.latitude : point?.latitude
    const longitude = home ? input.longitude : point?.longitude
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude)>90 || Math.abs(longitude)>180 || distanceKm(settings.baseLatitude,settings.baseLongitude,latitude,longitude)>5) {
      throw new Error('Elige una ubicación dentro del radio de 5 km.')
    }
    if (home && (total<settings.homeMinimum || (input.address?.trim().length ?? 0)<5)) throw new Error('Revisa el mínimo de compra y la dirección de entrega.')
    const transfer = input.payment === 'transfer'
    if (transfer && !settings.bankInstructions.trim()) throw new Error('La transferencia aún no está configurada.')
    const order = {
      id:crypto.randomUUID(), requestId:input.requestId, customerName:input.customerName, phone:input.phone,
      address:home ? input.address! : point!.name+' · '+point!.address, latitude,longitude,delivery:input.delivery,
      payment:input.payment,total,items,createdAt:new Date().toISOString(),
      status:(transfer ? 'awaiting_payment':'confirmed') as OrderStatus,
      bankInstructions:transfer?settings.bankInstructions:'',
      expiresAt:transfer ? new Date(Date.now()+settings.transferHours*3600000).toISOString():null,
    }
    state.orders.unshift(order)
    for (const product of state.products) if (input.productIds.includes(product.id)) product.status='reserved'
    return order
  })
}
export async function getOrders(): Promise<Order[]> {
  if (demoMode) { assertDemoAdmin(); return loadDemo().orders }
  check((await db().rpc('expire_store_orders')).error)
  const {data,error} = await db().from('store_orders').select('*').order('created_at',{ascending:false})
  check(error)
  return (data ?? []).map(row => ({
    id:row.id, createdAt:row.created_at, expiresAt:row.expires_at, total:row.total, items:row.items, payment:row.payment,
    delivery:row.delivery, address:row.address, latitude:row.latitude, longitude:row.longitude, phone:row.phone,
    customerName:row.customer_name, status:row.status, bankInstructions:row.bank_instructions,
  }))
}
export async function updateOrder(id: string, status: OrderStatus): Promise<void> {
  if (!demoMode) { check((await db().rpc('update_store_order',{order_id:id,next_status:status})).error); return }
  assertDemoAdmin()
  await changeDemo(state => {
    const order = state.orders.find(o => o.id===id)
    if (!order) throw new Error('No se encontró el pedido.')
    if (order.status===status) return
    const allowed = order.status==='awaiting_payment' ? ['confirmed','cancelled'] : order.status==='confirmed' ? ['delivered','cancelled'] : []
    if (!allowed.includes(status)) throw new Error('El cambio de estado no es válido.')
    order.status=status
    order.expiresAt=null
    if (status==='delivered' || status==='cancelled') {
      for (const p of state.products) if (order.items.some(item=>item.id===p.id)) p.status=status==='delivered' ? 'sold' : 'available'
    }
  })
}
