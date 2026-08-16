/* eslint-disable no-console */
/**
 * Master seed runner.
 *
 * Usage:
 *   pnpm seed           → seeds database with test data
 *   pnpm seed:reset     → drops database then reseeds
 *
 * Seeds created:
 *   super_admin:       admin@grandxl.com   / Admin@123
 *   restaurant_owner:  owner@grandxl.com   / Owner@123
 *   customer:          +2348012345678      / OTP: 123456 in dev
 *   rider:             +2348087654321      / OTP: 123456 in dev
 *   3 restaurants in Lagos with full menus
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../../../..', '.env') })

async function main(): Promise<void> {
  const shouldReset = process.argv.includes('--reset')

  console.log(`\n🌱 GrandXL Seed Runner`)
  console.log(`   Mode: ${shouldReset ? 'RESET + SEED' : 'SEED ONLY'}`)
  console.log(`   Database: ${process.env.MONGODB_URI ?? 'not set'}\n`)

  // Seed implementation lives in individual seed files.
  // This runner will import and call them once the User/Restaurant schemas
  // are built in Phase 2 (Auth + Users module).
  // For now, this file scaffolds the entry point and documents the plan.

  console.log('⚠️  Seed data requires Phase 2 schemas to be built first.')
  console.log('   Come back after completing the Auth and Users modules.\n')
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
