import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  OnApplicationBootstrap,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { FoodCategoryDocument } from './schemas/food-category.schema'
import { UserRole } from '@grandxl/types'
import { slugify } from '@grandxl/utils'
import type { CreateFoodCategoryDto } from './dto/food-category.dto'
import type { UpdateFoodCategoryDto } from './dto/food-category.dto'

const DEFAULT_CATEGORIES = [
  { name: 'Rice',              slug: 'rice',              sortOrder: 0,  image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=120&h=120&fit=crop&q=75' },
  { name: 'Chicken',           slug: 'chicken',           sortOrder: 1,  image: 'https://images.unsplash.com/photo-1598514982641-e924c324d23a?w=120&h=120&fit=crop&q=75' },
  { name: 'Swallow',           slug: 'swallow',           sortOrder: 2,  image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=120&h=120&fit=crop&q=75' },
  { name: 'Soups & Stews',     slug: 'soups-stews',       sortOrder: 3,  image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=120&h=120&fit=crop&q=75' },
  { name: 'Burgers',           slug: 'burgers',           sortOrder: 4,  image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=120&h=120&fit=crop&q=75' },
  { name: 'Pizza',             slug: 'pizza',             sortOrder: 5,  image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=120&h=120&fit=crop&q=75' },
  { name: 'Shawarma',          slug: 'shawarma',          sortOrder: 6,  image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=120&h=120&fit=crop&q=75' },
  { name: 'Grills & Suya',     slug: 'grills-suya',       sortOrder: 7,  image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=120&h=120&fit=crop&q=75' },
  { name: 'Seafood',           slug: 'seafood',           sortOrder: 8,  image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=120&h=120&fit=crop&q=75' },
  { name: 'Fast Food',         slug: 'fast-food',         sortOrder: 9,  image: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=120&h=120&fit=crop&q=75' },
  { name: 'Snacks',            slug: 'snacks',            sortOrder: 10, image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=120&h=120&fit=crop&q=75' },
  { name: 'Breakfast',         slug: 'breakfast',         sortOrder: 11, image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=120&h=120&fit=crop&q=75' },
  { name: 'Continental',       slug: 'continental',       sortOrder: 12, image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&h=120&fit=crop&q=75' },
  { name: 'Chinese',           slug: 'chinese',           sortOrder: 13, image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=120&h=120&fit=crop&q=75' },
  { name: 'Desserts',          slug: 'desserts',          sortOrder: 14, image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=120&h=120&fit=crop&q=75' },
  { name: 'Drinks & Smoothies',slug: 'drinks-smoothies',  sortOrder: 15, image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=120&h=120&fit=crop&q=75' },
  { name: 'Wraps & Sandwiches',slug: 'wraps-sandwiches',  sortOrder: 16, image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=120&h=120&fit=crop&q=75' },
  { name: 'Healthy',           slug: 'healthy',           sortOrder: 17, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&h=120&fit=crop&q=75' },
]

@Injectable()
export class FoodCategoriesService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(FoodCategoryDocument.name)
    private readonly model: Model<FoodCategoryDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const ops = DEFAULT_CATEGORIES.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: { $setOnInsert: { ...c, isActive: true, createdBy: null } },
        upsert: true,
      },
    }))
    await this.model.bulkWrite(ops, { ordered: false })
  }

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name)
    let slug = base
    let counter = 2
    while (true) {
      const existing = await this.model.findOne({ slug }).lean()
      if (!existing || existing._id.toString() === excludeId) break
      slug = `${base}-${counter++}`
    }
    return slug
  }

  async findAll(): Promise<FoodCategoryDocument[]> {
    const docs = await this.model.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean()
    return docs as unknown as FoodCategoryDocument[]
  }

  async findAllAdmin(): Promise<FoodCategoryDocument[]> {
    const docs = await this.model.find().sort({ sortOrder: 1, createdAt: 1 }).lean()
    return docs as unknown as FoodCategoryDocument[]
  }

  async create(restaurantId: string, dto: CreateFoodCategoryDto): Promise<FoodCategoryDocument> {
    const slug = await this.generateUniqueSlug(dto.name)

    const doc = new this.model({
      name: dto.name.trim(),
      slug,
      image: dto.image ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: true,
      createdBy: new Types.ObjectId(restaurantId),
    })

    return doc.save()
  }

  async update(
    id: string,
    requesterId: string,
    requesterRoles: UserRole[],
    dto: UpdateFoodCategoryDto,
  ): Promise<FoodCategoryDocument> {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Food category not found')

    const isPlatformDefault = doc.createdBy === null
    const isOwner = doc.createdBy?.toString() === requesterId
    const isAdmin = requesterRoles.includes(UserRole.SUPER_ADMIN)

    if (!isPlatformDefault && !isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to update this category')
    }

    const updates: Record<string, unknown> = {}
    if (dto.name !== undefined) {
      updates.name = dto.name.trim()
      updates.slug = await this.generateUniqueSlug(dto.name, id)
    }
    if (dto.image !== undefined) updates.image = dto.image
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder
    if (dto.isActive !== undefined) updates.isActive = dto.isActive

    const updated = await this.model.findByIdAndUpdate(id, { $set: updates }, { new: true })
    if (!updated) throw new NotFoundException('Food category not found')
    return updated
  }

  async remove(
    id: string,
    requesterId: string,
    requesterRoles: UserRole[],
  ): Promise<void> {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Food category not found')

    const isPlatformDefault = doc.createdBy === null
    const isOwner = doc.createdBy?.toString() === requesterId
    const isAdmin = requesterRoles.includes(UserRole.SUPER_ADMIN)

    // Platform defaults can be deleted by any restaurant owner or admin
    // Owner-created categories can only be deleted by their creator or admin
    if (!isPlatformDefault && !isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this category')
    }

    await this.model.findByIdAndDelete(id)
  }
}
