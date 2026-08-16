/* eslint-disable no-console */
/**
 * Migration: convert User.role (single) → User.roles (array)
 *
 * Idempotent — safe to re-run. Runs in two passes:
 *   1. Backfill: for every user with `role` set and no `roles` array, copy `role` into `roles: [role]`.
 *   2. Cleanup:  unset the legacy `role` field on every user that now has a populated `roles` array.
 *
 * Usage:
 *   cd apps/api && pnpm exec ts-node src/database/migrations/2026-06-26-role-to-roles.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import mongoose from 'mongoose'

// __dirname = apps/api/src/database/migrations → up 3 to apps/api/.env
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') })

async function main(): Promise<void> {
  const mongoUri = process.env['MONGODB_URI']
  if (!mongoUri) {
    console.error('❌  MONGODB_URI is not set in .env')
    process.exit(1)
  }

  await mongoose.connect(mongoUri)
  const users = mongoose.connection.collection('users')
  console.log('🛠  Connected. Starting role → roles migration…')

  // Pass 1 — backfill roles from role for users missing the array
  const backfill = await users.updateMany(
    { role: { $exists: true, $type: 'string' }, $or: [{ roles: { $exists: false } }, { roles: { $size: 0 } }] },
    [{ $set: { roles: ['$role'] } }],
  )
  console.log(`✅  Backfilled roles[] from role on ${backfill.modifiedCount} user(s).`)

  // Pass 2 — drop the now-redundant role field anywhere a roles array exists
  const cleanup = await users.updateMany(
    { role: { $exists: true }, roles: { $exists: true, $not: { $size: 0 } } },
    { $unset: { role: '' } },
  )
  console.log(`🧹  Removed legacy role field from ${cleanup.modifiedCount} user(s).`)

  // Sanity check — anyone still missing roles?
  const orphans = await users.countDocuments({ roles: { $exists: false } })
  if (orphans > 0) {
    console.warn(`⚠️  ${orphans} user(s) still have no roles[] — likely admin/system docs. Review manually.`)
  } else {
    console.log('🎉  All users now have a roles[] array.')
  }

  await mongoose.disconnect()
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
