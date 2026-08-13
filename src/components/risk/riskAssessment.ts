import type { MeasurementReading, RiskAssessment } from '../../types/measurement.types'

/**
 * Evaluación de riesgo predictivo más reciente entre las lecturas (la de
 * timestamp mayor que traiga `riskAssessment` no nulo). Devuelve `null` si el
 * modelo aún no ha procesado datos. Nunca rompe con lecturas parciales o
 * timestamps inválidos.
 */
export function getLatestRiskAssessment(
  readings: MeasurementReading[],
): RiskAssessment | null {
  let latest: RiskAssessment | null = null
  let latestTime = Number.NEGATIVE_INFINITY
  for (const reading of readings) {
    if (!reading?.riskAssessment) {
      continue
    }
    const time = new Date(reading.timestamp ?? '').getTime()
    if (Number.isFinite(time) && time >= latestTime) {
      latestTime = time
      latest = reading.riskAssessment
    }
  }
  return latest
}
