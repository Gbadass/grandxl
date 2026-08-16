/* eslint-disable no-console */
/**
 * Super-admin seed — creates one SUPER_ADMIN user for immediate testing.
 *
 * Usage:
 *   pnpm seed:admin           → creates super admin (idempotent)
 *   pnpm seed:admin --reset   → drops all users then recreates
 *
 * Credentials created:
 *   Email:    admin@grandxl.com
 *   Password: Admin@123
 *   Role:     super_admin
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import mongoose from 'mongoose'
import * as bcrypt from 'bcryptjs'

dotenv.config({ path: path.resolve(__dirname, '../../../../..', '.env') })

const BCRYPT_ROUNDS = 12

const UserSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, unique: true, sparse: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: String,
    roles: { type: [String], default: ['customer'] },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    avatar: { type: String, default: null },
    expoPushToken: { type: String, default: null },
    addresses: { type: [], default: [] },
    defaultAddressId: { type: mongoose.Schema.Types.ObjectId, default: null },
    country: { type: String, default: 'NG' },
    currency: { type: String, default: 'NGN' },
    locale: { type: String, default: 'en-NG' },
    consentGiven: { type: Boolean, default: false },
    consentDate: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
)

async function main(): Promise<void> {
  const mongoUri = process.env['MONGODB_URI']
  if (!mongoUri) {
    console.error('❌  MONGODB_URI is not set in .env')
    process.exit(1)
  }

  const shouldReset = process.argv.includes('--reset')

  await mongoose.connect(mongoUri)
  console.log(`\n🌱 Super-Admin Seed Runner`)
  console.log(`   Mode: ${shouldReset ? 'RESET + CREATE' : 'CREATE (idempotent)'}`)

  const User = mongoose.model('User', UserSchema)

  if (shouldReset) {
    await User.deleteMany({})
    console.log('   ⚠️  All users deleted')
  }

  const email = 'admin@grandxl.com'
  const existing = await User.findOne({ email })

  if (existing) {
    console.log(`\n✅  Super admin already exists: ${email}`)
  } else {
    const passwordHash = await bcrypt.hash('Admin@123', BCRYPT_ROUNDS)

    await User.create({
      firstName: 'Grand',
      lastName: 'Admin',
      email,
      passwordHash,
      roles: ['super_admin'],
      isVerified: true,
      isActive: true,
      country: 'NG',
      currency: 'NGN',
      locale: 'en-NG',
      consentGiven: true,
      consentDate: new Date(),
    })

    console.log(`\n✅  Super admin created:`)
    console.log(`   Email:    ${email}`)
    console.log(`   Password: Admin@123`)
    console.log(`   Role:     super_admin`)
    console.log(`\n⚠️  Change this password immediately after first login.\n`)
  }

  await mongoose.disconnect()
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
