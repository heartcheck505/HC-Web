import { describe, expect, it } from 'vitest'
import type { MeasurementReading, RiskAssessment } from '../../types/measurement.types'
import { getLatestRiskAssessment } from './riskAssessment'

function make(
  id: string,
  riskAssessment: RiskAssessment | null | undefined,
  timestamp: string,
): MeasurementReading {
  return {
    timestamp,
    deviceId: 'd1',
    bpm: 72,
    quality: null,
    context: null,
    isNormal: true,
    notes: null,
    symptoms: [],
    riskAssessment,
    patientId: id,
  }
}

describe('getLatestRiskAssessment', () => {
  it('devuelve el riskAssessment de la lectura más reciente', () => {
    const older: RiskAssessment = {
      riskLevel: 'medio',
      score: 45,
      recommendation: 'Continuar monitoreo.',
    }
    const newer: RiskAssessment = {
      riskLevel: 'alto',
      score: 72,
      recommendation: 'Consultar al médico.',
    }
    const readings = [
      make('a', older, '2026-08-01T10:00:00Z'),
      make('b', newer, '2026-08-02T10:00:00Z'),
    ]
    expect(getLatestRiskAssessment(readings)).toEqual(newer)
  })

  it('ignora lecturas sin riskAssessment y devuelve null si ninguna lo trae', () => {
    const readings = [
      make('a', null, '2026-08-01T10:00:00Z'),
      make('b', undefined, '2026-08-02T10:00:00Z'),
      make('c', null, '2026-08-03T10:00:00Z'),
    ]
    expect(getLatestRiskAssessment(readings)).toBeNull()
    expect(getLatestRiskAssessment([])).toBeNull()
  })

  it('no rompe con timestamps inválidos o lecturas parciales', () => {
    const valid: RiskAssessment = {
      riskLevel: 'bajo',
      score: 10,
      recommendation: null,
    }
    const readings = [
      make('bad', valid, 'no-es-una-fecha'),
      make('ok', valid, '2026-08-01T10:00:00Z'),
    ]
    expect(getLatestRiskAssessment(readings)).toEqual(valid)
  })
})