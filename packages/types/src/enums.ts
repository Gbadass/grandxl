export enum UserRole {
  CUSTOMER = 'customer',
  RESTAURANT_OWNER = 'restaurant_owner',
  RIDER = 'rider',
  SUPER_ADMIN = 'super_admin',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  PAYSTACK = 'paystack',
  WALLET = 'wallet',
  CASH = 'cash',
}

export enum RestaurantApprovalStatus {
  PENDING_REVIEW = 'pending_review',
  INFO_REQUESTED = 'info_requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum VehicleType {
  BICYCLE = 'bicycle',
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
}

export enum DeliveryFeeType {
  FIXED = 'fixed',
  DISTANCE_BASED = 'distance_based',
}

export enum NotificationType {
  ORDER_STATUS = 'order_status',
  NEW_ORDER = 'new_order',
  RIDER_JOB = 'rider_job',
  PROMO = 'promo',
  SYSTEM = 'system',
}

export enum Country {
  NIGERIA = 'NG',
  GHANA = 'GH',
  KENYA = 'KE',
}

export enum Currency {
  NGN = 'NGN',
  GHS = 'GHS',
  KES = 'KES',
}
