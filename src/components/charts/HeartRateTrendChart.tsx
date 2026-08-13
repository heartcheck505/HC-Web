import { useMemo } from 'react'
import type { MeasurementHistoryItem } from '../../types/measurement.types'
import { limitHistoryToLast } from './historyLimit'

const WIDTH = 600
const HEIGHT = 190
const PAD_TOP = 18
const PAD_BOTTOM = 28
const PAD_X = 10

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) {
    return null
  }
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? null : time
}

function formatTick(iso: string | null, showTime: boolean): string {
  const time = parseTime(iso)
  if (time === null) {
    return '—'
  }
  return new Date(time).toLocaleString(
    'es-ES',
    showTime
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short' },
  )
}

interface HeartRateTrendChartProps {
  items: MeasurementHistoryItem[]
}

/**
 * Gráfica de tendencia de frecuencia cardíaca alimentada por
 * `GET /api/measurements/history`. Representa solo los últimos 10 registros
 * cronológicos; se adapta a menos registros y muestra un estado vacío si la
 * API no devuelve mediciones.
 */
export default function HeartRateTrendChart({
  items,
}: HeartRateTrendChartProps) {
  const points = useMemo(() => limitHistoryToLast(items), [items])

  const chart = useMemo(() => {
    if (points.length === 0) {
      return null
    }
    const bpmValues = points.map((point) => point.bpm)
    const minBpm = Math.min(...bpmValues)
    const maxBpm = Math.max(...bpmValues)
    let span = maxBpm - minBpm
    if (span === 0) {
      span = Math.max(1, Math.abs(maxBpm) * 0.1)
    }
    const lo = minBpm - span * 0.15
    const hi = maxBpm + span * 0.15

    const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
    const stepX =
      points.length === 1 ? 0 : (WIDTH - PAD_X * 2) / (points.length - 1)
    const coord = (index: number, bpm: number) => ({
      x: points.length === 1 ? WIDTH / 2 : PAD_X + index * stepX,
      y: PAD_TOP + ((hi - bpm) / (hi - lo)) * plotHeight,
    })

    const coords = points.map((point, index) => ({
      ...coord(index, point.bpm),
      bpm: point.bpm,
      recordedAt: point.recordedAt,
    }))
    const line = coords
      .map(
        (c, index) =>
          `${index === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
      )
      .join(' ')
    const lastX = coords[coords.length - 1].x
    const firstX = coords[0].x
    const baselineY = HEIGHT - PAD_BOTTOM
    const area = `${line} L ${lastX.toFixed(1)} ${baselineY} L ${firstX.toFixed(1)} ${baselineY} Z`

    const validTimes = points
      .map((point) => parseTime(point.recordedAt))
      .filter((time): time is number => time !== null)
    const showTime =
      validTimes.length > 0 &&
      validTimes.every(
        (time) =>
          new Date(time).toDateString() ===
          new Date(validTimes[0]).toDateString(),
      )
    const gridValues = [lo, (lo + hi) / 2, hi]

    return {
      coords,
      line,
      area,
      baselineY,
      showTime,
      gridValues,
      hi,
      lo,
      plotHeight,
    }
  }, [points])

  if (chart === null) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
        Sin mediciones disponibles del dispositivo.
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Gráfica de tendencia de frecuencia cardíaca (últimos 10 registros)"
    >
      <line
        x1={PAD_X}
        x2={WIDTH - PAD_X}
        y1={chart.baselineY}
        y2={chart.baselineY}
        stroke="#cbd5e1"
        strokeWidth="1"
        aria-hidden="true"
      />
      {chart.gridValues.map((value) => {
        const y = PAD_TOP + ((chart.hi - value) / (chart.hi - chart.lo)) * chart.plotHeight
        return (
          <g key={value}>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 4"
              aria-hidden="true"
            />
            <text
              x={WIDTH - PAD_X}
              y={y - 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              {Math.round(value)} BPM
            </text>
          </g>
        )
      })}
      <path d={chart.area} fill="#3b82f6" opacity="0.15" aria-hidden="true" />
      <path
        d={chart.line}
        fill="none"
        stroke="#2563eb"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      />
      {chart.coords.map((c) => (
        <circle
          key={`${c.recordedAt}-${c.bpm}`}
          cx={c.x}
          cy={c.y}
          r="4"
          fill="#ffffff"
          stroke="#2563eb"
          strokeWidth="2"
          aria-hidden="true"
        />
      ))}
      {chart.coords.map((c) => (
        <text
          key={`label-${c.recordedAt}-${c.bpm}`}
          x={c.x}
          y={HEIGHT - 8}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
        >
          {formatTick(c.recordedAt, chart.showTime)}
        </text>
      ))}
    </svg>
  )
}