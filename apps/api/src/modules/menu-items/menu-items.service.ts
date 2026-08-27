import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { MenuCategoryDocument } from './schemas/menu-category.schema'
import { MenuItemDocument } from './schemas/menu-item.schema'
import { RestaurantsService } from '../restaurants/restaurants.service'
import type { CreateMenuCategoryDto, UpdateMenuCategoryDto } from './dto/menu-category.dto'
import type { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto'

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectModel(MenuCategoryDocument.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
    @InjectModel(MenuItemDocument.name)
    private readonly itemModel: Model<MenuItemDocument>,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  // ── Ownership guard — ensures requester owns the restaurant ──────
  // SUPER_ADMINs bypass the check. Fetches the raw restaurant (bypasses
  // isApproved/isActive filters) so owners can manage menus during review.

  private async assertRestaurantOwner(
    restaurantId: string,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<void> {
    if (isSuperAdmin) return
    const restaurant = await this.restaurantsService.findByIdRaw(restaurantId)
    if (restaurant.ownerId.toString() !== requesterId) {
      throw new ForbiddenException('You do not own this restaurant')
    }
  }

  // ── Categories ───────────────────────────────────────────────────

  async getCategories(restaurantId: string): Promise<MenuCategoryDocument[]> {
    return this.categoryModel
      .find({ restaurantId: new Types.ObjectId(restaurantId), isActive: true })
      .sort({ sortOrder: 1 })
      .lean() as unknown as MenuCategoryDocument[]
  }

  async createCategory(
    restaurantId: string,
    dto: CreateMenuCategoryDto,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<MenuCategoryDocument> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    const category = new this.categoryModel({
      restaurantId: new Types.ObjectId(restaurantId),
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      sortOrder: dto.sortOrder ?? 0,
    })
    return category.save()
  }

  async updateCategory(
    categoryId: string,
    restaurantId: string,
    dto: UpdateMenuCategoryDto,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<MenuCategoryDocument> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    const category = await this.categoryModel.findById(categoryId)
    if (!category) throw new NotFoundException('Category not found')
    if (category.restaurantId.toString() !== restaurantId) {
      throw new ForbiddenException('Category does not belong to this restaurant')
    }

    const updates: Record<string, unknown> = {}
    if (dto.name !== undefined) updates.name = dto.name.trim()
    if (dto.description !== undefined) updates.description = dto.description.trim()
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder

    const updated = await this.categoryModel
      .findByIdAndUpdate(categoryId, { $set: updates }, { new: true })
      .exec()

    if (!updated) throw new NotFoundException('Category not found')
    return updated
  }

  async deleteCategory(
    categoryId: string,
    restaurantId: string,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<void> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    const category = await this.categoryModel.findById(categoryId)
    if (!category) throw new NotFoundException('Category not found')
    if (category.restaurantId.toString() !== restaurantId) {
      throw new ForbiddenException('Category does not belong to this restaurant')
    }

    // Prevent deletion if items still exist in this category
    const itemCount = await this.itemModel.countDocuments({
      categoryId: new Types.ObjectId(categoryId),
    })
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete category — it still has ${itemCount} menu item(s). Move or delete them first.`,
      )
    }

    await this.categoryModel.findByIdAndDelete(categoryId)
  }

  // ── Menu items ───────────────────────────────────────────────────

  async getMenuByRestaurant(restaurantId: string): Promise<{
    categories: MenuCategoryDocument[]
    items: MenuItemDocument[]
  }> {
    const [categories, items] = await Promise.all([
      this.categoryModel
        .find({ restaurantId: new Types.ObjectId(restaurantId), isActive: true })
        .sort({ sortOrder: 1 })
        .lean(),
      this.itemModel
        .find({ restaurantId: new Types.ObjectId(restaurantId), isAvailable: true })
        .sort({ sortOrder: 1 })
        .lean(),
    ])

    return {
      categories: categories as unknown as MenuCategoryDocument[],
      items: items as unknown as MenuItemDocument[],
    }
  }

  async getItemById(itemId: string): Promise<MenuItemDocument> {
    if (!Types.ObjectId.isValid(itemId)) throw new NotFoundException('Menu item not found')
    const item = await this.itemModel.findById(itemId)
    if (!item) throw new NotFoundException('Menu item not found')
    return item
  }

  async createItem(
    restaurantId: string,
    dto: CreateMenuItemDto,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<MenuItemDocument> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    // Verify category belongs to this restaurant
    if (!Types.ObjectId.isValid(dto.categoryId)) {
      throw new BadRequestException('Invalid category ID')
    }
    const category = await this.categoryModel.findById(dto.categoryId)
    if (!category || category.restaurantId.toString() !== restaurantId) {
      throw new BadRequestException('Category not found in this restaurant')
    }

    const item = new this.itemModel({
      restaurantId: new Types.ObjectId(restaurantId),
      categoryId: new Types.ObjectId(dto.categoryId),
      name: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      image: dto.image ?? null,
      basePrice: dto.basePrice,
      isAvailable: dto.isAvailable ?? true,
      isPopular: dto.isPopular ?? false,
      sortOrder: dto.sortOrder ?? 0,
      variants: dto.variants ?? [],
      addOns: dto.addOns ?? [],
      allergens: dto.allergens ?? [],
      calories: dto.calories ?? null,
    })

    return item.save()
  }

  async updateItem(
    itemId: string,
    restaurantId: string,
    dto: UpdateMenuItemDto,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<MenuItemDocument> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    if (!Types.ObjectId.isValid(itemId)) throw new NotFoundException('Menu item not found')
    const item = await this.itemModel.findById(itemId)
    if (!item) throw new NotFoundException('Menu item not found')
    if (item.restaurantId.toString() !== restaurantId) {
      throw new ForbiddenException('Menu item does not belong to this restaurant')
    }

    // If changing category, verify new category belongs to this restaurant
    if (dto.categoryId !== undefined) {
      if (!Types.ObjectId.isValid(dto.categoryId)) {
        throw new BadRequestException('Invalid category ID')
      }
      const cat = await this.categoryModel.findById(dto.categoryId)
      if (!cat || cat.restaurantId.toString() !== restaurantId) {
        throw new BadRequestException('Category not found in this restaurant')
      }
    }

    const updates: Record<string, unknown> = {}
    if (dto.name !== undefined) updates.name = dto.name.trim()
    if (dto.description !== undefined) updates.description = dto.description.trim()
    if (dto.image !== undefined) updates.image = dto.image
    if (dto.basePrice !== undefined) updates.basePrice = dto.basePrice
    if (dto.categoryId !== undefined) updates.categoryId = new Types.ObjectId(dto.categoryId)
    if (dto.isAvailable !== undefined) updates.isAvailable = dto.isAvailable
    if (dto.isPopular !== undefined) updates.isPopular = dto.isPopular
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder
    if (dto.variants !== undefined) updates.variants = dto.variants
    if (dto.addOns !== undefined) updates.addOns = dto.addOns
    if (dto.allergens !== undefined) updates.allergens = dto.allergens
    if (dto.calories !== undefined) updates.calories = dto.calories

    const updated = await this.itemModel
      .findByIdAndUpdate(itemId, { $set: updates }, { new: true })
      .exec()

    if (!updated) throw new NotFoundException('Menu item not found')
    return updated
  }

  async deleteItem(
    itemId: string,
    restaurantId: string,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<void> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    if (!Types.ObjectId.isValid(itemId)) throw new NotFoundException('Menu item not found')
    const item = await this.itemModel.findById(itemId)
    if (!item) throw new NotFoundException('Menu item not found')
    if (item.restaurantId.toString() !== restaurantId) {
      throw new ForbiddenException('Menu item does not belong to this restaurant')
    }
    await this.itemModel.findByIdAndDelete(itemId)
  }

  // ── Sprint 12 (S12-7): bulk edit ─────────────────────────────────
  //
  // All four bulk operations share the same guardrails: verify the caller owns
  // the restaurant, coerce/validate every input id, refuse if any id doesn't
  // resolve to an item on this restaurant (all-or-nothing — surfaces typos or
  // stale UI state instead of silently skipping). Uses `updateMany`/`deleteMany`
  // so the DB does the work in one round-trip rather than N calls.

  private toObjectIds(itemIds: string[]): Types.ObjectId[] {
    return itemIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id))
  }

  private async assertItemsBelongToRestaurant(
    itemIds: string[],
    restaurantId: string,
  ): Promise<Types.ObjectId[]> {
    const oids = this.toObjectIds(itemIds)
    if (oids.length !== itemIds.length) {
      throw new BadRequestException('One or more item IDs are invalid')
    }
    const count = await this.itemModel.countDocuments({
      _id:          { $in: oids },
      restaurantId: new Types.ObjectId(restaurantId),
    })
    if (count !== oids.length) {
      throw new BadRequestException(
        `Only ${count} of ${oids.length} items belong to this restaurant — refresh and try again`,
      )
    }
    return oids
  }

  async bulkSetAvailability(
    restaurantId: string,
    itemIds: string[],
    isAvailable: boolean,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<{ modifiedCount: number }> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    const oids = await this.assertItemsBelongToRestaurant(itemIds, restaurantId)
    const res = await this.itemModel.updateMany(
      { _id: { $in: oids } },
      { $set: { isAvailable } },
    )
    return { modifiedCount: res.modifiedCount ?? 0 }
  }

  // Sprint 12 (S12-8): promote/demote menu items. Writes to the existing
  // `isPopular` schema field — kept for back-compat with the customer-side
  // "Popular" badge that already reads it. Restaurant portal UI surfaces it
  // as "Featured" since the toggle is curatorial (the owner picks), not
  // data-driven ("popular with customers").
  async bulkSetFeatured(
    restaurantId: string,
    itemIds: string[],
    isFeatured: boolean,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<{ modifiedCount: number }> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    const oids = await this.assertItemsBelongToRestaurant(itemIds, restaurantId)
    const res = await this.itemModel.updateMany(
      { _id: { $in: oids } },
      { $set: { isPopular: isFeatured } },
    )
    return { modifiedCount: res.modifiedCount ?? 0 }
  }

  async bulkMoveCategory(
    restaurantId: string,
    itemIds: string[],
    categoryId: string,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<{ modifiedCount: number }> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid category ID')
    }
    // Target category must exist on this restaurant — same rule as single-item move.
    const cat = await this.categoryModel.findById(categoryId)
    if (!cat || cat.restaurantId.toString() !== restaurantId) {
      throw new BadRequestException('Category not found in this restaurant')
    }
    const oids = await this.assertItemsBelongToRestaurant(itemIds, restaurantId)
    const res = await this.itemModel.updateMany(
      { _id: { $in: oids } },
      { $set: { categoryId: new Types.ObjectId(categoryId) } },
    )
    return { modifiedCount: res.modifiedCount ?? 0 }
  }

  async bulkAdjustPrice(
    restaurantId: string,
    itemIds: string[],
    mode: 'percent' | 'fixed' | 'set',
    value: number,
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<{ modifiedCount: number }> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)

    // Sanity checks — the DTO validates types but not domain ranges.
    if (mode === 'percent' && (value < -95 || value > 500)) {
      throw new BadRequestException('Percent must be between −95 and 500')
    }
    if ((mode === 'fixed' || mode === 'set') && !Number.isInteger(value)) {
      throw new BadRequestException('Kobo values must be integers')
    }
    if (mode === 'set' && value < 0) {
      throw new BadRequestException('Set price cannot be negative')
    }

    const oids = await this.assertItemsBelongToRestaurant(itemIds, restaurantId)

    // Aggregation pipeline update — computes newPrice per document from oldPrice.
    // Mongo evaluates $round/$max/$multiply per-document so we don't need to
    // fan out into N calls. Requires MongoDB 4.2+.
    const priceExpr =
      mode === 'set'
        ? value
        : mode === 'fixed'
          ? { $max: [{ $add: ['$basePrice', value] }, 0] }
          : { $round: [{ $multiply: ['$basePrice', 1 + value / 100] }, 0] }

    const res = await this.itemModel.updateMany(
      { _id: { $in: oids } },
      [{ $set: { basePrice: priceExpr } }],
    )
    return { modifiedCount: res.modifiedCount ?? 0 }
  }

  async bulkDelete(
    restaurantId: string,
    itemIds: string[],
    requesterId: string,
    isSuperAdmin: boolean,
  ): Promise<{ deletedCount: number }> {
    await this.assertRestaurantOwner(restaurantId, requesterId, isSuperAdmin)
    const oids = await this.assertItemsBelongToRestaurant(itemIds, restaurantId)
    const res = await this.itemModel.deleteMany({ _id: { $in: oids } })
    return { deletedCount: res.deletedCount ?? 0 }
  }

  // ── Stock mutation ──────────────────────────────────────────────
  // Atomic decrement using $inc with a $gte filter — guarantees no oversell
  // even under concurrent order create. Returns false if stock is insufficient.
  // null stockCount means unlimited; we short-circuit those without touching the doc.
  async tryDecrementStock(
    itemId: string,
    quantity: number,
  ): Promise<{ ok: true; remaining: number | null } | { ok: false; reason: string }> {
    const existing = await this.itemModel.findById(itemId, { stockCount: 1, name: 1, isAvailable: 1, lowStockThreshold: 1 }).lean()
    if (!existing) return { ok: false, reason: 'Menu item not found' }
    if (existing.stockCount === null || existing.stockCount === undefined) {
      return { ok: true, remaining: null }
    }

    const updated = await this.itemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(itemId), stockCount: { $gte: quantity } },
      { $inc: { stockCount: -quantity } },
      { new: true },
    ).lean()
    if (!updated) return { ok: false, reason: `Only ${existing.stockCount} of "${existing.name}" left` }

    const remaining = updated.stockCount ?? 0
    // Flip availability off once we hit zero stock — keeps it out of menus until
    // the restaurant restocks.
    if (remaining === 0 && updated.isAvailable) {
      await this.itemModel.updateOne({ _id: updated._id }, { $set: { isAvailable: false } })
    }
    return { ok: true, remaining }
  }

  async restock(itemId: string, quantity: number): Promise<void> {
    // Called on order cancellation to refund stock. If the item was auto-disabled when
    // stock hit zero, the restaurant has to re-enable it manually — restocking alone
    // shouldn't re-publish a SKU they intentionally pulled.
    await this.itemModel.updateOne(
      { _id: new Types.ObjectId(itemId), stockCount: { $ne: null } },
      { $inc: { stockCount: quantity } },
    )
  }

  // ── Used by OrdersService to validate items at order time ─────────

  async findItemsByIds(itemIds: string[]): Promise<MenuItemDocument[]> {
    return this.itemModel
      .find({ _id: { $in: itemIds.map((id) => new Types.ObjectId(id)) } })
      .lean() as unknown as MenuItemDocument[]
  }

  // ── Used by SearchService ─────────────────────────────────────────

  async searchByText(
    q: string,
    page: number,
    limit: number,
  ): Promise<MenuItemDocument[]> {
    const skip = (page - 1) * limit
    const results = await this.itemModel
      .find({ $text: { $search: q }, isAvailable: true }, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .lean()
    return results as unknown as MenuItemDocument[]
  }
}
