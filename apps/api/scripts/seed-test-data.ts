/**
 * Seeds realistic test data: 3 restaurants, menu items, 2 riders, 20 orders.
 * Run: npx tsx scripts/seed-test-data.ts
 */
import 'dotenv/config'
import mongoose, { Types } from 'mongoose'
import bcrypt from 'bcryptjs'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/grandxl'

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  const db = mongoose.connection.db!

  // ── Helpers ────────────────────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 10)
  const id = () => new Types.ObjectId()
  const now = new Date()
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

  // ── 1. Restaurant owners ───────────────────────────────────────────────────
  const owner1Id = id()
  const owner2Id = id()
  const owner3Id = id()

  const owners = [
    {
      _id: owner1Id,
      firstName: 'Chidi', lastName: 'Okonkwo',
      email: 'chidi@testrestaurant.com',
      phone: '+2348011111111',
      role: 'restaurant_owner',
      passwordHash: await hash('Test@1234'),
      isVerified: true, isActive: true,
      avatar: null, expoPushToken: null,
      addresses: [], defaultAddressId: null,
      country: 'NG', currency: 'NGN', locale: 'en-NG',
      consentGiven: true, consentDate: daysAgo(30),
      lastLoginAt: daysAgo(1), deletedAt: null,
      createdAt: daysAgo(30), updatedAt: daysAgo(1),
    },
    {
      _id: owner2Id,
      firstName: 'Amaka', lastName: 'Eze',
      email: 'amaka@testrestaurant.com',
      phone: '+2348022222222',
      role: 'restaurant_owner',
      passwordHash: await hash('Test@1234'),
      isVerified: true, isActive: true,
      avatar: null, expoPushToken: null,
      addresses: [], defaultAddressId: null,
      country: 'NG', currency: 'NGN', locale: 'en-NG',
      consentGiven: true, consentDate: daysAgo(20),
      lastLoginAt: daysAgo(2), deletedAt: null,
      createdAt: daysAgo(20), updatedAt: daysAgo(2),
    },
    {
      _id: owner3Id,
      firstName: 'Tunde', lastName: 'Adeyemi',
      email: 'tunde@testrestaurant.com',
      phone: '+2348033333333',
      role: 'restaurant_owner',
      passwordHash: await hash('Test@1234'),
      isVerified: true, isActive: true,
      avatar: null, expoPushToken: null,
      addresses: [], defaultAddressId: null,
      country: 'NG', currency: 'NGN', locale: 'en-NG',
      consentGiven: true, consentDate: daysAgo(10),
      lastLoginAt: daysAgo(3), deletedAt: null,
      createdAt: daysAgo(10), updatedAt: daysAgo(3),
    },
  ]

  await db.collection('users').insertMany(owners)
  console.log('✅ Restaurant owners created')

  // ── 2. Restaurants ─────────────────────────────────────────────────────────
  const r1Id = id()
  const r2Id = id()
  const r3Id = id()

  const openingHours = {
    monday:    { open: '08:00', close: '22:00', isOpen: true },
    tuesday:   { open: '08:00', close: '22:00', isOpen: true },
    wednesday: { open: '08:00', close: '22:00', isOpen: true },
    thursday:  { open: '08:00', close: '22:00', isOpen: true },
    friday:    { open: '08:00', close: '23:00', isOpen: true },
    saturday:  { open: '09:00', close: '23:00', isOpen: true },
    sunday:    { open: '10:00', close: '21:00', isOpen: true },
  }

  const restaurants = [
    {
      _id: r1Id, ownerId: owner1Id,
      name: 'Mama Chidi Kitchen',
      slug: 'mama-chidi-kitchen',
      description: 'Authentic Nigerian home cooking. Soups, stews, and more.',
      logo: null, coverImage: null,
      phone: '+2348011111111', email: 'chidi@testrestaurant.com',
      cuisine: ['Nigerian', 'African'],
      address: {
        street: '14 Bourdillon Road', city: 'Ikoyi', state: 'Lagos',
        country: 'NG',
        coordinates: { type: 'Point', coordinates: [3.4378, 6.4487] },
      },
      openingHours,
      deliveryRadius: 5, minOrderAmount: 200000, // ₦2,000
      deliveryFeeType: 'fixed', deliveryFeeFixed: 80000, // ₦800
      estimatedDeliveryTime: 35,
      isActive: true, isOpen: true, isApproved: true,
      approvalStatus: 'approved',
      approvalNote: null, approvedAt: daysAgo(25), approvedBy: null,
      rating: 4.6, ratingCount: 38,
      country: 'NG', currency: 'NGN',
      bankDetails: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Chidi Okonkwo' },
      createdAt: daysAgo(28), updatedAt: daysAgo(1),
    },
    {
      _id: r2Id, ownerId: owner2Id,
      name: 'Amaka\'s Grill House',
      slug: 'amakas-grill-house',
      description: 'Grilled chicken, suya, and barbecue delights.',
      logo: null, coverImage: null,
      phone: '+2348022222222', email: 'amaka@testrestaurant.com',
      cuisine: ['Grill', 'Nigerian', 'BBQ'],
      address: {
        street: '7 Allen Avenue', city: 'Ikeja', state: 'Lagos',
        country: 'NG',
        coordinates: { type: 'Point', coordinates: [3.3522, 6.6018] },
      },
      openingHours,
      deliveryRadius: 6, minOrderAmount: 150000, // ₦1,500
      deliveryFeeType: 'fixed', deliveryFeeFixed: 60000, // ₦600
      estimatedDeliveryTime: 25,
      isActive: true, isOpen: true, isApproved: true,
      approvalStatus: 'approved',
      approvalNote: null, approvedAt: daysAgo(18), approvedBy: null,
      rating: 4.8, ratingCount: 72,
      country: 'NG', currency: 'NGN',
      bankDetails: { bankName: 'Access Bank', accountNumber: '0987654321', accountName: 'Amaka Eze' },
      createdAt: daysAgo(20), updatedAt: daysAgo(2),
    },
    {
      _id: r3Id, ownerId: owner3Id,
      name: 'Tunde\'s Pizza & Pasta',
      slug: 'tundes-pizza-pasta',
      description: 'Lagos-inspired pizza and Italian pasta dishes.',
      logo: null, coverImage: null,
      phone: '+2348033333333', email: 'tunde@testrestaurant.com',
      cuisine: ['Pizza', 'Italian', 'Fast Food'],
      address: {
        street: '25 Admiralty Way', city: 'Lekki', state: 'Lagos',
        country: 'NG',
        coordinates: { type: 'Point', coordinates: [3.5852, 6.4355] },
      },
      openingHours,
      deliveryRadius: 7, minOrderAmount: 250000, // ₦2,500
      deliveryFeeType: 'fixed', deliveryFeeFixed: 100000, // ₦1,000
      estimatedDeliveryTime: 40,
      isActive: true, isOpen: false, isApproved: false,
      approvalStatus: 'pending_review',
      approvalNote: null, approvedAt: null, approvedBy: null,
      rating: 0, ratingCount: 0,
      country: 'NG', currency: 'NGN',
      bankDetails: { bankName: null, accountNumber: null, accountName: null },
      createdAt: daysAgo(8), updatedAt: daysAgo(8),
    },
  ]

  await db.collection('restaurants').insertMany(restaurants)
  console.log('✅ Restaurants created')

  // ── 3. Menu categories & items ─────────────────────────────────────────────
  const cat1 = id(); const cat2 = id(); const cat3 = id()
  const cat4 = id(); const cat5 = id()

  const categories = [
    { _id: cat1, restaurantId: r1Id, name: 'Soups & Stews', description: 'Nigerian classics', sortOrder: 0, isActive: true, createdAt: daysAgo(28), updatedAt: daysAgo(28) },
    { _id: cat2, restaurantId: r1Id, name: 'Rice Dishes',   description: 'Jollof, fried rice and more', sortOrder: 1, isActive: true, createdAt: daysAgo(28), updatedAt: daysAgo(28) },
    { _id: cat3, restaurantId: r2Id, name: 'Grills',        description: 'Suya and grilled meats',    sortOrder: 0, isActive: true, createdAt: daysAgo(20), updatedAt: daysAgo(20) },
    { _id: cat4, restaurantId: r2Id, name: 'Sides',         description: 'Sides and extras',          sortOrder: 1, isActive: true, createdAt: daysAgo(20), updatedAt: daysAgo(20) },
    { _id: cat5, restaurantId: r3Id, name: 'Pizzas',        description: 'Hand-tossed Lagos style',   sortOrder: 0, isActive: true, createdAt: daysAgo(8),  updatedAt: daysAgo(8) },
  ]

  await db.collection('menu_categories').insertMany(categories)

  const item1 = id(); const item2 = id(); const item3 = id()
  const item4 = id(); const item5 = id(); const item6 = id()

  const menuItems = [
    { _id: item1, restaurantId: r1Id, categoryId: cat1, name: 'Egusi Soup + Eba', description: 'Rich egusi soup with stockfish and goat meat', image: null, basePrice: 280000, isAvailable: true, isPopular: true, sortOrder: 0, variants: [], addOns: [], allergens: [], calories: null, createdAt: daysAgo(27), updatedAt: daysAgo(1) },
    { _id: item2, restaurantId: r1Id, categoryId: cat2, name: 'Jollof Rice + Chicken', description: 'Party-style jollof rice with grilled chicken', image: null, basePrice: 320000, isAvailable: true, isPopular: true, sortOrder: 0, variants: [], addOns: [], allergens: [], calories: null, createdAt: daysAgo(27), updatedAt: daysAgo(1) },
    { _id: item3, restaurantId: r2Id, categoryId: cat3, name: 'Chicken Suya (500g)', description: 'Spicy grilled chicken on skewers with yaji', image: null, basePrice: 380000, isAvailable: true, isPopular: true, sortOrder: 0, variants: [], addOns: [], allergens: [], calories: null, createdAt: daysAgo(19), updatedAt: daysAgo(1) },
    { _id: item4, restaurantId: r2Id, categoryId: cat3, name: 'Beef Suya (500g)',    description: 'Classic beef suya with onions and tomatoes', image: null, basePrice: 420000, isAvailable: true, isPopular: false, sortOrder: 1, variants: [], addOns: [], allergens: [], calories: null, createdAt: daysAgo(19), updatedAt: daysAgo(1) },
    { _id: item5, restaurantId: r2Id, categoryId: cat4, name: 'Plantain (per order)', description: 'Sweet fried plantain (dodo)', image: null, basePrice: 80000, isAvailable: true, isPopular: false, sortOrder: 0, variants: [], addOns: [], allergens: [], calories: null, createdAt: daysAgo(19), updatedAt: daysAgo(1) },
    { _id: item6, restaurantId: r3Id, categoryId: cat5, name: 'Pepperoni Lagos',    description: 'Pepperoni with scotch bonnet drizzle', image: null, basePrice: 550000, isAvailable: true, isPopular: true, sortOrder: 0, variants: [], addOns: [], allergens: [], calories: null, createdAt: daysAgo(7),  updatedAt: daysAgo(7) },
  ]

  await db.collection('menu_items').insertMany(menuItems)
  console.log('✅ Menu items created')

  // ── 4. Riders ──────────────────────────────────────────────────────────────
  const riderUser1Id = id(); const riderUser2Id = id()
  const rider1Id = id();    const rider2Id = id()

  const riderUsers = [
    { _id: riderUser1Id, firstName: 'Emeka', lastName: 'Nwosu', email: 'emeka.rider@test.com', phone: '+2348044444444', role: 'rider', passwordHash: await hash('Test@1234'), isVerified: true, isActive: true, avatar: null, expoPushToken: null, addresses: [], defaultAddressId: null, country: 'NG', currency: 'NGN', locale: 'en-NG', consentGiven: true, consentDate: daysAgo(15), lastLoginAt: daysAgo(1), deletedAt: null, createdAt: daysAgo(15), updatedAt: daysAgo(1) },
    { _id: riderUser2Id, firstName: 'Bola',  lastName: 'Adesanya', email: 'bola.rider@test.com',  phone: '+2348055555555', role: 'rider', passwordHash: await hash('Test@1234'), isVerified: true, isActive: true, avatar: null, expoPushToken: null, addresses: [], defaultAddressId: null, country: 'NG', currency: 'NGN', locale: 'en-NG', consentGiven: true, consentDate: daysAgo(10), lastLoginAt: daysAgo(2), deletedAt: null, createdAt: daysAgo(10), updatedAt: daysAgo(2) },
  ]

  await db.collection('users').insertMany(riderUsers)

  const riders = [
    { _id: rider1Id, userId: riderUser1Id, vehicleType: 'motorcycle', vehiclePlate: 'LAG-234-KL', isVerified: true, isOnline: true, isAvailable: true, currentLocation: { type: 'Point', coordinates: [3.3792, 6.5244], bearing: 0, updatedAt: new Date() }, rating: 4.7, ratingCount: 45, totalDeliveries: 89, earnings: { totalKobo: 45000000, pendingKobo: 2000000 }, documents: { idCard: 'id_doc_url', driverLicense: 'license_url', vehiclePhoto: 'vehicle_url' }, createdAt: daysAgo(15), updatedAt: daysAgo(1) },
    { _id: rider2Id, userId: riderUser2Id, vehicleType: 'bicycle',    vehiclePlate: null,          isVerified: false, isOnline: false, isAvailable: false, currentLocation: { type: 'Point', coordinates: [3.3522, 6.6018], bearing: 0, updatedAt: new Date() }, rating: 0, ratingCount: 0, totalDeliveries: 0, earnings: { totalKobo: 0, pendingKobo: 0 }, documents: { idCard: null, driverLicense: null, vehiclePhoto: null }, createdAt: daysAgo(10), updatedAt: daysAgo(10) },
  ]

  await db.collection('riders').insertMany(riders)
  console.log('✅ Riders created')

  // ── 5. Customers ───────────────────────────────────────────────────────────
  const cust1Id = id(); const cust2Id = id()

  const customers = [
    { _id: cust1Id, firstName: 'Ngozi', lastName: 'Obi', email: 'ngozi@test.com', phone: '+2348066666666', role: 'customer', passwordHash: await hash('Test@1234'), isVerified: true, isActive: true, avatar: null, expoPushToken: null, addresses: [], defaultAddressId: null, country: 'NG', currency: 'NGN', locale: 'en-NG', consentGiven: true, consentDate: daysAgo(14), lastLoginAt: daysAgo(1), deletedAt: null, createdAt: daysAgo(14), updatedAt: daysAgo(1) },
    { _id: cust2Id, firstName: 'Seun',  lastName: 'Bello', email: 'seun@test.com',  phone: '+2348077777777', role: 'customer', passwordHash: await hash('Test@1234'), isVerified: true, isActive: true, avatar: null, expoPushToken: null, addresses: [], defaultAddressId: null, country: 'NG', currency: 'NGN', locale: 'en-NG', consentGiven: true, consentDate: daysAgo(12), lastLoginAt: daysAgo(3), deletedAt: null, createdAt: daysAgo(12), updatedAt: daysAgo(3) },
  ]

  await db.collection('users').insertMany(customers)
  console.log('✅ Customers created')

  // ── 6. Orders ──────────────────────────────────────────────────────────────
  const deliveryAddr = {
    street: '5 Marina Street', city: 'Lagos Island', state: 'Lagos',
    coordinates: { type: 'Point', coordinates: [3.3958, 6.4541] },
  }

  const makeOrder = (
    n: number,
    customerId: Types.ObjectId,
    restaurantId: Types.ObjectId,
    riderId: Types.ObjectId | null,
    itemName: string,
    itemId: Types.ObjectId,
    itemPrice: number,
    qty: number,
    status: string,
    paymentStatus: string,
    daysBack: number,
  ) => {
    const subtotal = itemPrice * qty
    const deliveryFee = 80000
    const serviceFee = Math.round(subtotal * 0.05)
    const total = subtotal + deliveryFee + serviceFee
    return {
      _id: id(),
      orderNumber: `GXL-${new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10).replace(/-/g, '')}-${String(n).padStart(4, '0')}`,
      customerId, restaurantId, riderId,
      status,
      items: [{
        menuItemId: itemId, name: itemName, image: null,
        basePrice: itemPrice, quantity: qty,
        selectedVariants: [], selectedAddOns: [],
        itemTotal: itemPrice * qty, note: null,
      }],
      deliveryAddress: deliveryAddr,
      pricing: { subtotal, deliveryFee, serviceFee, discount: 0, vat: 0, total },
      payment: { method: 'paystack', status: paymentStatus, reference: paymentStatus === 'paid' ? `PSK_REF_${n}` : null, paidAt: paymentStatus === 'paid' ? daysAgo(daysBack) : null },
      coupon: { code: null, discountAmount: 0 },
      customerNote: null, estimatedTime: 35,
      actualDeliveryAt: status === 'delivered' ? daysAgo(daysBack) : null,
      cancelReason: status === 'cancelled' ? 'Customer requested cancellation' : null,
      timeoutJobId: null,
      country: 'NG', currency: 'NGN',
      createdAt: daysAgo(daysBack), updatedAt: daysAgo(daysBack),
    }
  }

  const orders = [
    makeOrder(1,  cust1Id, r1Id, rider1Id, 'Egusi Soup + Eba',       item1, 280000, 2, 'delivered',  'paid',    7),
    makeOrder(2,  cust2Id, r1Id, rider1Id, 'Jollof Rice + Chicken',  item2, 320000, 1, 'delivered',  'paid',    6),
    makeOrder(3,  cust1Id, r2Id, rider1Id, 'Chicken Suya (500g)',    item3, 380000, 1, 'delivered',  'paid',    5),
    makeOrder(4,  cust2Id, r2Id, rider1Id, 'Beef Suya (500g)',       item4, 420000, 2, 'delivered',  'paid',    4),
    makeOrder(5,  cust1Id, r1Id, rider1Id, 'Jollof Rice + Chicken',  item2, 320000, 3, 'delivered',  'paid',    3),
    makeOrder(6,  cust2Id, r2Id, null,     'Chicken Suya (500g)',    item3, 380000, 2, 'cancelled',  'pending', 3),
    makeOrder(7,  cust1Id, r1Id, rider1Id, 'Egusi Soup + Eba',       item1, 280000, 1, 'delivered',  'paid',    2),
    makeOrder(8,  cust2Id, r2Id, rider1Id, 'Beef Suya (500g)',       item4, 420000, 1, 'delivered',  'paid',    2),
    makeOrder(9,  cust1Id, r2Id, rider1Id, 'Chicken Suya (500g)',    item3, 380000, 3, 'delivered',  'paid',    1),
    makeOrder(10, cust2Id, r1Id, rider1Id, 'Jollof Rice + Chicken',  item2, 320000, 2, 'delivered',  'paid',    1),
    makeOrder(11, cust1Id, r1Id, null,     'Egusi Soup + Eba',       item1, 280000, 2, 'preparing',  'paid',    0),
    makeOrder(12, cust2Id, r2Id, null,     'Chicken Suya (500g)',    item3, 380000, 1, 'confirmed',  'paid',    0),
    makeOrder(13, cust1Id, r2Id, null,     'Beef Suya (500g)',       item4, 420000, 1, 'pending',    'pending', 0),
    makeOrder(14, cust2Id, r1Id, null,     'Jollof Rice + Chicken',  item2, 320000, 1, 'pending',    'pending', 0),
    makeOrder(15, cust1Id, r1Id, rider1Id, 'Egusi Soup + Eba',       item1, 280000, 3, 'delivered',  'paid',    8),
    makeOrder(16, cust2Id, r2Id, rider1Id, 'Chicken Suya (500g)',    item3, 380000, 2, 'delivered',  'paid',    9),
    makeOrder(17, cust1Id, r1Id, rider1Id, 'Jollof Rice + Chicken',  item2, 320000, 1, 'delivered',  'paid',   10),
    makeOrder(18, cust2Id, r2Id, rider1Id, 'Beef Suya (500g)',       item4, 420000, 2, 'delivered',  'paid',   11),
    makeOrder(19, cust1Id, r1Id, rider1Id, 'Egusi Soup + Eba',       item1, 280000, 1, 'delivered',  'paid',   12),
    makeOrder(20, cust2Id, r2Id, rider1Id, 'Chicken Suya (500g)',    item3, 380000, 1, 'delivered',  'paid',   13),
  ]

  await db.collection('orders').insertMany(orders)
  console.log('✅ 20 orders created')

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n🎉 Test data seeded successfully!')
  console.log('   Restaurants : 3 (2 approved, 1 pending review)')
  console.log('   Riders      : 2 (1 verified, 1 pending)')
  console.log('   Customers   : 2')
  console.log('   Orders      : 20 (16 delivered, 2 active, 1 cancelled, 2 pending)')
  console.log('\n   Restaurant owner logins (all password: Test@1234):')
  console.log('   chidi@testrestaurant.com  — Mama Chidi Kitchen')
  console.log('   amaka@testrestaurant.com  — Amaka\'s Grill House')

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
