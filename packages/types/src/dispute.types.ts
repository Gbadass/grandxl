export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed'

export interface Dispute {
  _id: string
  orderId: string
  customerId: string
  type: string
  description: string
  status: DisputeStatus
  resolution?: string
  resolvedBy?: string
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}
