import { z } from "zod";
import { mongoObjectId, coordinatesSchema } from "./common";
import { PaymentMethod, OrderStatus } from "@grandxl/types";

const orderItemVariantSchema = z.object({
  variantName: z.string().min(1),
  optionName: z.string().min(1),
  priceAdjustment: z.number().int().nonnegative(),
});

const orderItemAddOnSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
});

const orderItemSchema = z.object({
  menuItemId: mongoObjectId,
  quantity: z.number().int().min(1).max(20),
  selectedVariants: z.array(orderItemVariantSchema).default([]),
  selectedAddOns: z.array(orderItemAddOnSchema).default([]),
  note: z.string().max(200).optional(),
});

const deliveryAddressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(200),
  coordinates: coordinatesSchema,
})

export const createOrderSchema = z.object({
  restaurantId: mongoObjectId,
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  deliveryAddress: deliveryAddressSchema,
  paymentMethod: z.nativeEnum(PaymentMethod),
  couponCode: z.string().toUpperCase().trim().optional(),
  customerNote: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancelReason: z.string().max(500).optional(),
});

export type CreateOrderValues = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusValues = z.infer<typeof updateOrderStatusSchema>;
