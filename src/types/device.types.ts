export type DeviceStatus = 'Active' | 'Inactive' | 'Maintenance' | 'LowBattery'

export interface Device {
  id: string
  serialNumber: string
  model: string
  patientId: string | null
  status: DeviceStatus
  batteryLevel: number
  location: string | null
  lastSyncAt: string | null
  createdAt: string
}

export interface DeviceRegistrationRequest {
  deviceIdentifier: string
  deviceModel: string
  firmwareVersion?: string
  batteryLevel?: number
}

export interface DeviceUpdateRequest {
  patientId?: string | null
  status?: DeviceStatus
  location?: string
}

export interface DeviceListQuery {
  status?: DeviceStatus
  patientId?: string
  search?: string
  page?: number
  pageSize?: number
}