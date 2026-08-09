export interface Measurement {
  id: string
  patientId: string
  deviceId: string
  heartRate: number
  systolic: number
  diastolic: number
  spo2: number
  respiratoryRate: number
  temperature: number
  recordedAt: string
}

export interface MeasurementQuery {
  patientId?: string
  deviceId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface MeasurementSummary {
  latestHeartRate: number | null
  averageHeartRate: number | null
  minHeartRate: number | null
  maxHeartRate: number | null
  latestSpo2: number | null
  measurementCount: number
  lastRecordedAt: string | null
}