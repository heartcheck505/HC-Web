export interface Plan {
  id: string
  name: string
  description?: string | null
  price?: number | null
  currency?: string | null
  durationDays?: number | null
  isActive?: boolean
  features?: string[]
  /** Alias alternativos con los que el portal local identifica al plan. */
  keywords?: string[]
}

export interface UserPlanSubscription {
  id?: string | null
  userId?: string | null
  planId?: string | null
  plan?: Plan | null
  planName?: string | null
  status?: string | null
  startedAt?: string | null
  expiresAt?: string | null
}

export interface SubscribeToPlanRequest {
  planId: string
}