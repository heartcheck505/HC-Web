import type { MeasurementReading } from '../../types/measurement.types'

export const MAX_HISTORY_POINTS = 10

export interface HeartRatePoint {
  bpm: number
  timestamp: string | null
}

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) {
    return null
  }
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? null : time
}

function isReadable(
  item: MeasurementReading,
): item is MeasurementReading & { bpm: number } {
  return typeof item.bpm === 'number' && Number.isFinite(item.bpm)
}

/**
 * Hora extraída del `timestamp` de una lectura en formato hh:mm.
 */
export function formatTimeLabel(
  iso: string | null | undefined,
): string {
  const time = parseTime(iso)
  if (time === null) {
    return '—'
  }
  return new Date(time).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Extrae únicamente los últimos `maxPoints` registros cronológicos de BPM
 * válidos: filtra lecturas sin BPM y ordena por `timestamp` ascendente antes
 * de recortar. Devuelve menos puntos cuando la API entrega menos registros.
 */
export function limitHistoryToLast(
  items: MeasurementReading[],
  maxPoints = MAX_HISTORY_POINTS,
): HeartRatePoint[] {
  return items
    .filter(isReadable)
    .sort((a, b) => {
      const ta = parseTime(a.timestamp)
      const tb = parseTime(b.timestamp)
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
    .map((item) => ({ bpm: item.bpm, timestamp: item.timestamp ?? null }))
}

/**
 * Últimas `count` lecturas completas (con su `isNormal` para badges),
 * ordenadas por `timestamp` descendente, para listas de "Registros recientes".
 */
export function limitLatestReadings(
  items: MeasurementReading[],
  count = 5,
): MeasurementReading[] {
  return items
    .filter(isReadable)
    .sort((a, b) => {
      const ta = parseTime(a.timestamp)
      const tb = parseTime(b.timestamp)
      if (ta === null && tb === null) {
        return 0
      }
      if (ta === null) {
        return 1
      }
      if (tb === null) {
        return -1
      }
      return tb - ta
    })
    .slice(0, count)
}

/**
 * Etiqueta clínica de una lectura según la propiedad exacta `isNormal` de
 * `GET /api/measurements`: `true` = "Normal", `false` = "Alto". Sin dato
 * explícito se presume normal para no alarmar con lecturas incompletas.
 */
export function normalLabel(
  isNormal: boolean | null | undefined,
): 'Normal' | 'Alto' {
  return isNormal === false ? 'Alto' : 'Normal'
}