import { Link } from 'react-router-dom'
import { BrainCircuit, Lock, Sparkles } from 'lucide-react'
import type { RiskAssessment } from '../../types/measurement.types'

interface RiskAssessmentCardProps {
  /** Evaluación más reciente del modelo de ML, o `null` mientras no hay datos. */
  riskAssessment?: RiskAssessment | null
  /** Plan básico: la tarjeta se bloquea con el callout de Plan Premium. */
  locked?: boolean
}

const riskTones: Record<
  NonNullable<RiskAssessment['riskLevel']>,
  { badge: string; dot: string; label: string }
> = {
  bajo: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Riesgo bajo' },
  medio: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Riesgo medio' },
  alto: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'Riesgo alto' },
  critico: { badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', label: 'Riesgo crítico' },
}

/**
 * Tarjeta "Análisis Predictivo (ML)":
 * - Plan básico (`locked`): callout que anuncia que la función es Premium.
 * - Sin datos del modelo: estado por defecto "Evaluando tendencias...".
 * - Con `riskAssessment`: badge de nivel de riesgo, puntaje y recomendación.
 * Nunca rompe con `riskAssessment` nulo o parcial.
 */
export default function RiskAssessmentCard({
  riskAssessment = null,
  locked = false,
}: RiskAssessmentCardProps) {
  if (locked) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-200">
          <Lock className="size-5 text-slate-600" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <BrainCircuit className="size-4 text-slate-500" aria-hidden="true" />
            Análisis Predictivo (ML)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            La evaluación de riesgo con Machine Learning está reservada para el
            Plan Premium.
          </p>
          <Link
            to="/planes"
            className="mt-2 inline-block rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Actualizar a Premium
          </Link>
        </div>
      </div>
    )
  }

  if (!riskAssessment) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10">
          <Sparkles className="size-5 text-blue-600" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-900">
            <BrainCircuit className="size-4 text-blue-700" aria-hidden="true" />
            Análisis Predictivo (ML)
          </p>
          <p className="mt-1 text-xs text-blue-700/80">
            Evaluando tendencias… El modelo de riesgo se activa con más
            lecturas del dispositivo.
          </p>
        </div>
      </div>
    )
  }

  const tone =
    riskAssessment.riskLevel !== null
      ? riskTones[riskAssessment.riskLevel]
      : null

  return (
    <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-bold text-blue-950">
          <BrainCircuit className="size-4 text-blue-700" aria-hidden="true" />
          Análisis Predictivo (ML)
        </p>
        {tone ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.badge}`}
          >
            <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
            {tone.label}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Sin clasificación
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Puntaje de riesgo</dt>
          <dd className="font-semibold text-slate-900">
            {riskAssessment.score !== null
              ? `${riskAssessment.score}${riskAssessment.score <= 100 ? '/100' : ''}`
              : '—'}
          </dd>
        </div>
        {riskAssessment.recommendation && (
          <div className="rounded-lg bg-white/70 px-3 py-2.5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recomendación del modelo
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-700">
              {riskAssessment.recommendation}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
