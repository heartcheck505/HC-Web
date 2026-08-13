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
  /**
   * Evaluación de riesgo del modelo de Machine Learning. Exclusivo para
   * consumo del Plan Premium: `null`/ausente mientras el modelo no retorna
   * datos o cuando el plan no la incluye. La UI debe degradar sin romper.
   */
  riskAssessment?: RiskAssessment | null
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

/**
 * Nivel de riesgo del modelo de ML, normalizado por el cliente a un vocabulario
 * único (el backend puede devolver variantes en inglés o español).
 */
export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'critico'

/**
 * Evaluación de riesgo predictivo generada por el modelo de Machine Learning,
 * devuelta por la API dentro de cada medición (`riskAssessment`). Puede venir
 * `null` mientras el modelo no ha procesado tendencias suficientes.
 */
export interface RiskAssessment {
  riskLevel: RiskLevel | null
  score: number | null
  recommendation: string | null
}