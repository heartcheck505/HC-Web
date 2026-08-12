import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Lock, X } from 'lucide-react'

interface PlanChangeModalProps {
  open: boolean
  mode: 'upgrade' | 'downgrade'
  planName: string
  price: string
  onClose: () => void
  onConfirmed: () => void
}

/**
 * Modal de confirmación de cambio de plan (upgrade/downgrade) para la sesión
 * activa. No redirige al registro: solo actualiza la licencia del usuario
 * autenticado vía `setUserPlan` (manejado por el llamador).
 *
 * DevSecOps: el "pago" es simulado (sin cargo real) y la confirmación no
 * transmite datos de tarjeta en ningún momento.
 */
export default function PlanChangeModal({
  open,
  mode,
  planName,
  price,
  onClose,
  onConfirmed,
}: PlanChangeModalProps) {
  const timerRef = useRef<number | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!open) {
      setProcessing(false)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  if (!open) {
    return null
  }

  const isUpgrade = mode === 'upgrade'

  const handleConfirm = (): void => {
    setProcessing(true)
    timerRef.current = window.setTimeout(() => {
      setProcessing(false)
      onConfirmed()
    }, 900)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-change-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={processing ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span
            className={`flex size-12 items-center justify-center rounded-full ${
              isUpgrade ? 'bg-amber-100' : 'bg-slate-100'
            }`}
          >
            <BadgeCheck
              className={`size-6 ${isUpgrade ? 'text-amber-600' : 'text-slate-500'}`}
              aria-hidden="true"
            />
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <h2 id="plan-change-title" className="mt-4 text-lg font-bold text-slate-900">
          {isUpgrade
            ? `Confirmar actualización a ${planName}`
            : `Cambiar a plan ${planName}`}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {isUpgrade
            ? `Se aplicará un cargo de ${price}/mes a tu método de pago y tu acceso al Dashboard Premium se activará de inmediato en esta sesión.`
            : 'Tu suscripción actual dejará de estar activa y perderás el acceso al Dashboard Premium.'}
        </p>

        <dl className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Plan seleccionado</dt>
            <dd className="font-semibold text-slate-900">{planName}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Costo</dt>
            <dd className="font-semibold text-slate-900">{price}/mes</dd>
          </div>
          {isUpgrade && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Dashboard Premium</dt>
              <dd className="font-semibold text-emerald-600">Incluido</dd>
            </div>
          )}
        </dl>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          Pago simulado para evaluación — no se realizará ningún cargo real.
        </p>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {processing
              ? 'Procesando…'
              : isUpgrade
                ? 'Confirmar y pagar'
                : 'Confirmar cambio'}
          </button>
        </div>
      </div>
    </div>
  )
}