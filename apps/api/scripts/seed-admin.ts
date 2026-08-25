/**
 * Creates the super admin user.
 * Run: npx ts-node -r tsconfig-paths/register scripts/seed-admin.ts
 * Or:  npx tsx scripts/seed-admin.ts
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/grandxl'

const ADMIN_EMAIL = 'theboyfakaa@gmail.com'
const ADMIN_PASSWORD = 'Createlove$500'

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB:', MONGODB_URI)

  const db = mongoose.connection.db!

  const existing = await db.collection('users').findOne({ email: ADMIN_EMAIL })
  if (existing) {
    if (Array.isArray(existing.roles) && existing.roles.includes('super_admin')) {
      console.log('Super admin already exists:', ADMIN_EMAIL)
    } else {
      await db.collection('users').updateOne({ email: ADMIN_EMAIL }, { $set: { roles: ['super_admin'] } })
      console.log('✅ Updated existing user to super_admin:', ADMIN_EMAIL)
    }
    await mongoose.disconnect()
    return
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  await db.collection('users').insertOne({
    firstName: 'Gerald',
    lastName: 'Admin',
    email: ADMIN_EMAIL,
    phone: null,
    roles: ['super_admin'],
    passwordHash,
    isVerified: true,
    isActive: true,
    avatar: null,
    expoPushToken: null,
    addresses: [],
    defaultAddressId: null,
    country: 'NG',
    currency: 'NGN',
    locale: 'en-NG',
    consentGiven: true,
    consentDate: new Date(),
    lastLoginAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  console.log('✅ Super admin created:', ADMIN_EMAIL)
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
