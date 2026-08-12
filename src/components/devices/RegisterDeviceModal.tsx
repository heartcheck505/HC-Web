import { useState } from 'react'
import type { FormEvent } from 'react'
import { registerDevice } from '../../api/apiClient'
import { Watch, X } from 'lucide-react'
import type { Device } from '../../types/device.types'

const DEVICE_MODELS = ['Galaxy Watch 6', 'Pixel Watch 2', 'Smartwatch G3']

interface RegisterDeviceModalProps {
  open: boolean
  onClose: () => void
  onRegistered?: (device: Device) => void
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20'

export default function RegisterDeviceModal({
  open,
  onClose,
  onRegistered,
}: RegisterDeviceModalProps) {
  const [deviceIdentifier, setDeviceIdentifier] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return null
  }

  const resetForm = (): void => {
    setDeviceIdentifier('')
    setDeviceModel('')
    setError(null)
  }

  const handleClose = (): void => {
    if (submitting) {
      return
    }
    resetForm()
    onClose()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (submitting) {
      return
    }
    if (!deviceIdentifier.trim() || !deviceModel) {
      setError('Completa el identificador y el modelo del dispositivo.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const device = await registerDevice({
        deviceIdentifier: deviceIdentifier.trim(),
        name: deviceModel,
      })
      resetForm()
      onClose()
      onRegistered?.(device)
    } catch {
      setError(
        'No se pudo vincular el dispositivo. Verifica los datos e intenta nuevamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-device-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Watch className="size-6 text-blue-600" aria-hidden="true" />
            </span>
            <div>
              <h2 id="register-device-title" className="text-lg font-bold text-slate-900">
                Vincular Dispositivo Wear OS
              </h2>
              <p className="text-sm text-slate-500">
                Registra tu reloj inteligente para iniciar la telemetría.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="device-identifier" className="block text-sm font-medium text-slate-700">
              Identificador MAC / UUID
            </label>
            <input
              id="device-identifier"
              type="text"
              value={deviceIdentifier}
              onChange={(event) => setDeviceIdentifier(event.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              autoComplete="off"
              spellCheck={false}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="device-model" className="block text-sm font-medium text-slate-700">
              Modelo del dispositivo
            </label>
            <select
              id="device-model"
              value={deviceModel}
              onChange={(event) => setDeviceModel(event.target.value)}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="">Selecciona un modelo</option>
              {DEVICE_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Watch className="size-4" aria-hidden="true" />
              {submitting ? 'Vinculando...' : 'Vincular dispositivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}