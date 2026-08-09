export type AlertSeverity = 'Critical' | 'Warning' | 'Info'

export type AlertStatus = 'Active' | 'Acknowledged' | 'Resolved'

export type AlertType =
  | 'Tachycardia'
  | 'Bradycardia'
  | 'AtrialFibrillation'
  | 'Hypoxia'
  | 'Hypertension'
  | 'Hypotension'
  | 'DeviceDisconnection'
  | 'LowBattery'

export interface Alert {
  id: string
  patientId: string
  deviceId: string
  patientName: string
  type: AlertType
  message: string
  severity: AlertSeverity
  status: AlertStatus
  measuredValue: number | null
  normalMin: number | null
  normalMax: number | null
  createdAt: string
  ackAt: string | null
  resolvedAt: string | null
}

export interface AlertListQuery {
  patientId?: string
  severity?: AlertSeverity
  status?: AlertStatus
  type?: AlertType
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface ResolveAlertRequest {
  resolutionNote?: string
}