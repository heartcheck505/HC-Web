export type NotificationSeverity = 'Info' | 'Warning' | 'Critical'

export interface AppNotification {
  id: string
  title?: string | null
  message?: string | null
  type?: string | null
  severity?: NotificationSeverity | null
  isRead?: boolean
  readAt?: string | null
  createdAt?: string | null
}

export interface NotificationListQuery {
  isRead?: boolean
  from?: string
  to?: string
  page?: number
  pageSize?: number
}