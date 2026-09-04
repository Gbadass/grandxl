import type { MenuItem } from '@grandxl/types'

// S14-9: dietary filters derived from the existing `allergens` field on
// MenuItem — no schema change needed. Restaurants already tag items with
// allergen warnings; we invert that data to power "safe" filters:
//   - Gluten-free = allergens doesn't include any gluten-source
//   - Dairy-free  = allergens doesn't include milk/dairy/lactose/cheese
//   - Nut-free    = allergens doesn't include peanuts/tree nuts/nuts/almonds
//
// Vegan/vegetarian/halal need explicit tagging (allergens can't tell you a
// chicken curry isn't vegan) — deferred until a proper `dietary` field is
// added to MenuItem via a bigger schema change.

export type DietaryFilter = 'gluten_free' | 'dairy_free' | 'nut_free'

const GLUTEN_ALLERGENS = ['gluten', 'wheat', 'barley', 'rye', 'spelt']
const DAIRY_ALLERGENS  = ['milk', 'dairy', 'lactose', 'cheese', 'butter', 'cream']
const NUT_ALLERGENS    = ['peanut', 'peanuts', 'tree nut', 'tree nuts', 'nut', 'nuts', 'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'hazelnut', 'hazelnuts']

function allergensContainAny(itemAllergens: string[], keywords: string[]): boolean {
  const normalized = itemAllergens.map((a) => a.toLowerCase().trim())
  return keywords.some((kw) => normalized.some((a) => a.includes(kw)))
}

export function itemMatchesFilters(item: MenuItem, filters: Set<DietaryFilter>): boolean {
  if (filters.size === 0) return true
  for (const f of filters) {
    if (f === 'gluten_free' && allergensContainAny(item.allergens, GLUTEN_ALLERGENS)) return false
    if (f === 'dairy_free'  && allergensContainAny(item.allergens, DAIRY_ALLERGENS))  return false
    if (f === 'nut_free'    && allergensContainAny(item.allergens, NUT_ALLERGENS))    return false
  }
  return true
}
