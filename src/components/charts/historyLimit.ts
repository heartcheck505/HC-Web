import type { MeasurementHistoryItem } from '../../types/measurement.types'

export const MAX_HISTORY_POINTS = 10

export interface HeartRatePoint {
  bpm: number
  recordedAt: string | null
}

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) {
    return null
  }
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? null : time
}

/**
 * Extrae únicamente los últimos `maxPoints` registros cronológicos de BPM
 * válidos: filtra lecturas sin BPM y ordena por fecha ascendente antes de
 * recortar. Devuelve menos puntos cuando la API entrega menos registros.
 */
export function limitHistoryToLast(
  items: MeasurementHistoryItem[],
  maxPoints = MAX_HISTORY_POINTS,
): HeartRatePoint[] {
  return items
    .filter(
      (item): item is MeasurementHistoryItem & { bpm: number } =>
        typeof item.bpm === 'number' && Number.isFinite(item.bpm),
    )
    .sort((a, b) => {
      const ta = parseTime(a.recordedAt)
      const tb = parseTime(b.recordedAt)
      if (ta === null && tb === null) {
        return 0
      }
      if (ta === null) {
        return 1
      }
      if (tb === null) {
        return -1
      }
      return ta - tb
    })
    .slice(-maxPoints)
    .map((item) => ({ bpm: item.bpm, recordedAt: item.recordedAt ?? null }))
}