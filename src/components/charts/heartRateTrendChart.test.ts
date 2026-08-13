import { describe, expect, it } from 'vitest'
import type { MeasurementHistoryItem } from '../../types/measurement.types'
import { limitHistoryToLast } from './historyLimit'

interface MakeOptions {
  bpm?: number | null | undefined
  recordedAt?: string | null
}

function make(id: string, options: MakeOptions = {}): MeasurementHistoryItem {
  return {
    id,
    deviceId: 'd1',
    bpm: options.bpm,
    quality: 'Good',
    context: null,
    notes: null,
    recordedAt: options.recordedAt ?? null,
  }
}

describe('limitHistoryToLast', () => {
  it('devuelve todos los registros cuando hay 10 o menos', () => {
    const items = Array.from({ length: 6 }, (_, index) =>
      make(`m${index}`, {
        bpm: 60 + index,
        recordedAt: `2026-08-0${index + 1}T10:00:00Z`,
      }),
    )
    expect(limitHistoryToLast(items)).toHaveLength(6)
    expect(limitHistoryToLast([])).toEqual([])
  })

  it('extrae únicamente los últimos 10 registros cronológicos', () => {
    const items = Array.from({ length: 14 }, (_, index) =>
      make(`m${index}`, {
        bpm: 60 + index,
        recordedAt: `2026-08-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
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

  it('ordena por fecha ascendente antes de recortar', () => {
    const items = [
      make('mid', { bpm: 70, recordedAt: '2026-07-15T10:00:00Z' }),
      make('old', { bpm: 50, recordedAt: '2026-07-01T10:00:00Z' }),
      make('new', { bpm: 90, recordedAt: '2026-08-01T10:00:00Z' }),
    ]
    const result = limitHistoryToLast(items)
    expect(result.map((point) => point.bpm)).toEqual([50, 70, 90])
  })

  it('descarta registros sin BPM válido', () => {
    const items = [
      make('a', { bpm: null, recordedAt: '2026-08-01T10:00:00Z' }),
      make('b', { bpm: undefined, recordedAt: '2026-08-02T10:00:00Z' }),
      make('c', { bpm: 72, recordedAt: '2026-08-03T10:00:00Z' }),
    ]
    const result = limitHistoryToLast(items)
    expect(result).toHaveLength(1)
    expect(result[0].bpm).toBe(72)
  })

  it('conserva los registros sin fecha al final del ordenamiento', () => {
    const items = [
      make('s', { bpm: 80, recordedAt: null }),
      make('d', { bpm: 75, recordedAt: '2026-08-01T10:00:00Z' }),
    ]
    const result = limitHistoryToLast(items, 10)
    expect(result).toHaveLength(2)
    expect(result.map((point) => point.bpm)).toEqual([75, 80])
  })
})