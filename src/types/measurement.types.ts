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

/**
 * Medición enviada a `POST /api/measurements` según la especificación de
 * producción: `{ deviceId, bpm, quality, context, notes }`.
 */
export interface MeasurementSubmission {
  deviceId: string
  bpm: number
  quality?: string | null
  context?: string | null
  notes?: string | null
}

/**
 * Medición exacta devuelta por `GET /api/measurements`:
 * `{ timestamp, patientId, deviceId, bpm, quality, context, isNormal, notes }`.
 */
export interface MeasurementReading {
  timestamp: string
  patientId: string
  deviceId: string
  bpm: number
  quality: string | null
  context: string | null
  isNormal: boolean
  notes: string | null
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