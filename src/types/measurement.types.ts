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
 * `{ timestamp, deviceId, bpm, quality, context, isNormal, notes, symptoms }`.
 */
export interface MeasurementReading {
  timestamp: string
  deviceId: string
  bpm: number
  quality: string | null
  context: string | null
  isNormal: boolean
  notes: string | null
  /**
   * Síntomas asociados a la lectura como arreglo plano de textos. Puede
   * llegar `null`/ausente desde el backend; el cliente lo normaliza a un
   * arreglo vacío para que la UI nunca acceda a `undefined`.
   */
  symptoms?: string[] | null
  /** Presente solo en respuestas paginadas antiguas; la spec actual no lo incluye. */
  patientId?: string | null
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