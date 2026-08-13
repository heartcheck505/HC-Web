import { describe, expect, it } from 'vitest'
import type { MeasurementReading } from '../../types/measurement.types'
import {
  formatTimeLabel,
  limitHistoryToLast,
  limitLatestReadings,
  normalLabel,
} from './historyLimit'

interface MakeOptions {
  bpm?: number | null | undefined
  timestamp?: string | null
  patientId?: string
  deviceId?: string
  quality?: string | null
  context?: string | null
  isNormal?: boolean | null
  notes?: string | null
}

function make(_id: string, options: MakeOptions = {}): MeasurementReading {
  const base: Record<string, unknown> = {
    patientId: options.patientId ?? 'p1',
    deviceId: options.deviceId ?? 'd1',
    bpm: options.bpm ?? 72,
    quality: options.quality ?? 'Good',
    context: options.context ?? null,
    isNormal: options.isNormal ?? true,
    notes: options.notes ?? null,
    timestamp: options.timestamp ?? '2026-08-01T10:00:00Z',
    // Preserva valores explícitamente inválidos (null/undefined) que el
    // filtro debe descartar.
    ...('bpm' in options ? { bpm: options.bpm } : {}),
    ...('timestamp' in options ? { timestamp: options.timestamp } : {}),
  }
  return base as unknown as MeasurementReading
}

describe('limitHistoryToLast', () => {
  it('devuelve todos los registros cuando hay 10 o menos', () => {
    const items = Array.from({ length: 6 }, (_, index) =>
      make(`m${index}`, {
        bpm: 60 + index,
        timestamp: `2026-08-0${index + 1}T10:00:00Z`,
      }),
    )
    expect(limitHistoryToLast(items)).toHaveLength(6)
    expect(limitHistoryToLast([])).toEqual([])
  })

  it('extrae únicamente los últimos 10 registros cronológicos', () => {
    const items = Array.from({ length: 14 }, (_, index) =>
      make(`m${index}`, {
        bpm: 60 + index,
        timestamp: `2026-08-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
      }),
    )
    const result = limitHistoryToLast(items)
    expect(result).toHaveLength(10)
    expect(result[0].bpm).toBe(64)
    expect(result[result.length - 1].bpm).toBe(73)
    expect(result.map((point) => point.bpm)).toEqual([
      64, 65, 66, 67, 68, 69, 70, 71, 72, 73,
    ])
  })

  it('ordena por timestamp ascendente antes de recortar', () => {
    const items = [
      make('mid', { bpm: 70, timestamp: '2026-07-15T10:00:00Z' }),
      make('old', { bpm: 50, timestamp: '2026-07-01T10:00:00Z' }),
      make('new', { bpm: 90, timestamp: '2026-08-01T10:00:00Z' }),
    ]
    const result = limitHistoryToLast(items)
    expect(result.map((point) => point.bpm)).toEqual([50, 70, 90])
  })

  it('descarta registros sin BPM válido', () => {
    const items = [
      make('a', { bpm: null, timestamp: '2026-08-01T10:00:00Z' }),
      make('b', { bpm: undefined, timestamp: '2026-08-02T10:00:00Z' }),
      make('c', { bpm: 72, timestamp: '2026-08-03T10:00:00Z' }),
    ]
    const result = limitHistoryToLast(items)
    expect(result).toHaveLength(1)
    expect(result[0].bpm).toBe(72)
  })

  it('conserva los registros sin fecha al final del ordenamiento', () => {
    const items = [
      make('s', { bpm: 80, timestamp: null }),
      make('d', { bpm: 75, timestamp: '2026-08-01T10:00:00Z' }),
    ]
    const result = limitHistoryToLast(items, 10)
    expect(result).toHaveLength(2)
    expect(result.map((point) => point.bpm)).toEqual([75, 80])
  })
})

describe('limitLatestReadings', () => {
  it('devuelve las lecturas más recientes primero', () => {
    const items = [
      make('old', { bpm: 50, timestamp: '2026-07-01T10:00:00Z' }),
      make('new', { bpm: 90, timestamp: '2026-08-01T10:00:00Z' }),
      make('mid', { bpm: 70, timestamp: '2026-07-15T10:00:00Z' }),
    ]
    const result = limitLatestReadings(items, 2)
    expect(result).toHaveLength(2)
    expect(result.map((reading) => reading.bpm)).toEqual([90, 70])
  })

  it('conserva isNormal para los badges de la lista', () => {
    const items = [
      make('ok', { bpm: 70, isNormal: true, timestamp: '2026-08-01T10:00:00Z' }),
      make('alto', { bpm: 130, isNormal: false, timestamp: '2026-08-02T10:00:00Z' }),
    ]
    const result = limitLatestReadings(items)
    expect(result.map((reading) => reading.isNormal)).toEqual([false, true])
  })
})

describe('normalLabel', () => {
  it('etiqueta según la propiedad exacta isNormal', () => {
    expect(normalLabel(true)).toBe('Normal')
    expect(normalLabel(false)).toBe('Alto')
  })

  it('presume Normal sin dato explícito', () => {
    expect(normalLabel(null)).toBe('Normal')
    expect(normalLabel(undefined)).toBe('Normal')
  })
})

describe('formatTimeLabel', () => {
  it('extrae la hora hh:mm del timestamp', () => {
    expect(formatTimeLabel('2026-08-01T14:05:00Z')).toMatch(/14:05|\d{2}:\d{2}/)
    expect(formatTimeLabel(null)).toBe('—')
    expect(formatTimeLabel('no-es-una-fecha')).toBe('—')
  })
})