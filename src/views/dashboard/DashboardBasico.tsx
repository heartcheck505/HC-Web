import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Battery,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Heart,
  HeartPulse,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Star,
  Watch,
  X,
} from 'lucide-react'
import Sidebar from '../../components/layout/Sidebar'
import RegisterDeviceModal from '../../components/devices/RegisterDeviceModal'

const heartRateBars = [38, 62, 45, 74, 56, 80, 52, 66, 48, 72, 58, 68, 44, 76]

interface LogRowProps {
  day: number
  text: string
  emoji: string
  tone: 'gray' | 'amber'
}

function LogRow({ day, text, emoji, tone }: LogRowProps) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 ${
        tone === 'gray'
          ? 'border-slate-200 bg-slate-50'
          : 'border-amber-200 bg-amber-50/70'
      }`}
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
          tone === 'gray' ? 'bg-white text-slate-700' : 'bg-white text-slate-700'
        }`}
      >
        {day}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">{text}</p>
      </div>
      <span className="shrink-0 text-2xl" role="img" aria-label="Estado del día">
        {emoji}
      </span>
    </div>
  )
}

function PixelWatchVisual() {
  return (
    <div className="flex flex-col items-center">
      <div className="h-12 w-14 rounded-t-xl bg-slate-600/80" aria-hidden="true" />
      <div className="relative flex size-40 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-slate-700 to-slate-900 ring-4 ring-slate-600">
        <div className="flex size-32 flex-col items-center justify-center rounded-[2rem] bg-black shadow-[0_0_60px_-12px_rgba(37,99,235,0.8)]">
          <span className="text-xs font-semibold text-sky-300">09:41</span>
          <HeartPulse className="mt-1 size-10 animate-pulse text-emerald-400" />
          <span className="mt-1 text-[10px] font-semibold text-emerald-400">
            74 BPM
          </span>
        </div>
        <span
          className="absolute -right-1.5 top-1/2 h-10 w-1.5 -translate-y-1/2 rounded-full bg-slate-500"
          aria-hidden="true"
        />
      </div>
      <div className="h-12 w-14 rounded-b-xl bg-slate-600 dark:bg-slate-800" aria-hidden="true" />
    </div>
  )
}

export default function DashboardBasico() {
  const toastTimer = useRef<number | null>(null)

  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [symptomOpen, setSymptomOpen] = useState(false)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [symptomName, setSymptomName] = useState('')
  const [symptomIntensity, setSymptomIntensity] = useState('Leve')
  const [symptomNotes, setSymptomNotes] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string): void => {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current)
    }
    setToast(message)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 3000)
  }

  const handleSymptomSubmit = (): void => {
    setSymptomOpen(false)
    setSymptomName('')
    setSymptomIntensity('Leve')
    setSymptomNotes('')
    showToast('Síntoma registrado correctamente.')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main className="min-h-screen p-4 sm:p-6 lg:ml-64">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search patient or log..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEmergencyOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
            >
              🚨 Emergencia (Alerta)
            </button>
            <button
              type="button"
              aria-label="Notificaciones"
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Bell className="size-5" aria-hidden="true" />
              <span
                className="absolute right-2 top-2 size-2.5 rounded-full bg-red-500 ring-2 ring-white"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              aria-label="Mensajes"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="mt-8 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-950">
              Hola ***REMOVED***, monitoreando{' '}
              <span className="text-blue-600">***REMOVED***</span>
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Estatus Estable
              <span className="text-slate-400">• Actualizado hace 2 min</span>
            </p>
          </div>

          <Link
            to="/planes"
            className="group relative max-w-md rounded-2xl bg-blue-600 p-6 pr-16 text-white shadow-lg transition-colors hover:bg-blue-700"
          >
            <span className="absolute -top-3 left-6 flex size-10 items-center justify-center rounded-full bg-white text-blue-600 shadow-md">
              <Star className="size-5 fill-current" aria-hidden="true" />
            </span>
            <p className="font-bold">Plan básico activo</p>
            <p className="mt-1 text-sm text-blue-100 group-hover:underline">
              Mejora a Premium para análisis avanzados →
            </p>
          </Link>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3" aria-label="Métricas">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Frecuencia Cardiaca Reciente
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-red-100">
                <Heart className="size-5 text-red-500" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold text-slate-900">74</span>
              <span className="text-lg font-semibold text-slate-500">BPM</span>
            </div>
            <div className="mt-4 flex h-12 items-end gap-1.5" aria-hidden="true">
              {heartRateBars.map((height, index) => (
                <span
                  key={index}
                  className="w-2 rounded-full bg-rose-300"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <p className="mt-4 text-sm font-medium text-emerald-600">
              ~ Normal range (60-100)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Conexión del Dispositivo
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-100">
                <Watch className="size-5 text-sky-600" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-xl font-bold text-slate-900">Pixel Watch</p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Señal</span>
                <span className="font-semibold text-emerald-600">Excelente</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: '92%' }}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">Batería</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-500">
                <Battery className="size-4" aria-hidden="true" />
                <span className="text-amber-600">42%</span>
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Alertas
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Medición omitida
                  </p>
                  <p className="text-xs text-slate-500">Prevista a las 8:00 AM</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Paseo matutino
                  </p>
                  <p className="text-xs text-slate-500">30 min de actividad</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-2xl bg-blue-800 p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <ClipboardList className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-bold">Registro de Síntomas</p>
                  <p className="text-sm text-blue-200">
                    Registre manualmente cualquier mareo o molestia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSymptomOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
              >
                <Plus className="size-4" aria-hidden="true" />
                Nuevo Registro
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  Bitácora: Últimos 30 días
                </h3>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  Ver registro detallado
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <LogRow
                  day={24}
                  tone="gray"
                  emoji="😊"
                  text="24 de octubre - Día estable (Frecuencia cardíaca promedio: 72 lpm...)"
                />
                <LogRow
                  day={23}
                  tone="amber"
                  emoji="😐"
                  text="23 de octubre - Ligera fatiga (FR: 78 lpm)..."
                />
              </div>

              <div className="relative mt-4">
                <div className="pointer-events-none space-y-3 select-none blur-[1.5px]" aria-hidden="true">
                  <LogRow
                    day={22}
                    tone="gray"
                    text="22 de octubre - Día estable (Frecuencia cardíaca promedio: 71 lpm...)"
                    emoji="😊"
                  />
                  <LogRow
                    day={21}
                    tone="gray"
                    text="21 de octubre - Día estable (Frecuencia cardíaca promedio: 70 lpm...)"
                    emoji="😊"
                  />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/70 p-4 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-slate-200">
                    <Lock className="size-6 text-slate-600" aria-hidden="true" />
                  </span>
                  <p className="font-semibold text-slate-800">
                    Análisis de tendencias bloqueado
                  </p>
                  <p className="max-w-xs text-sm text-slate-500">
                    Actualice a Premium para visualizar las tendencias de salud
                    mensuales.
                  </p>
                  <Link
                    to="/planes"
                    className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Mejorar plan
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dispositivo del Paciente ·{' '}
                <span className="normal-case tracking-normal text-slate-900">
                  Pixel Watch
                </span>
              </h3>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Conectado
              </span>
            </div>

            <div className="mt-6 flex items-center justify-center rounded-2xl bg-slate-950 py-10">
              <PixelWatchVisual />
            </div>

            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2.5 text-slate-700">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                Conexión establecida
              </li>
              <li className="flex items-center gap-2.5 text-slate-600">
                <Clock className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
                Última sincronización: hace 30 s
              </li>
            </ul>

            <button
              type="button"
              onClick={() => setDeviceModalOpen(true)}
              className="mt-6 w-full rounded-xl border-2 border-blue-600 py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
            >
              Configuración de conexión
            </button>
          </div>
        </section>
      </main>

      <RegisterDeviceModal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        onRegistered={() => {
          setDeviceModalOpen(false)
          showToast('Dispositivo Wear OS vinculado correctamente.')
        }}
      />

      {emergencyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setEmergencyOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <span className="flex size-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-6 text-red-600" aria-hidden="true" />
              </span>
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <h2 id="emergency-title" className="mt-4 text-lg font-bold text-slate-900">
              ¿Confirmar llamada de emergencia?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Se contactará de inmediato al número de emergencia configurado
              para ***REMOVED***.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmergencyOpen(false)
                  showToast('Servicio de emergencia notificado.')
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
              >
                Llama ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {symptomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="symptom-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setSymptomOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="symptom-title" className="text-lg font-bold text-slate-900">
                  Nuevo Registro de Síntoma
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Describe la molestia para el seguimiento de ***REMOVED***.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSymptomOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                handleSymptomSubmit()
              }}
            >
              <div>
                <label htmlFor="symptom-name" className="block text-sm font-medium text-slate-700">
                  Tipo de síntoma
                </label>
                <input
                  id="symptom-name"
                  type="text"
                  value={symptomName}
                  onChange={(event) => setSymptomName(event.target.value)}
                  placeholder="Ej. Mareo, dolor de cabeza..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label htmlFor="symptom-intensity" className="block text-sm font-medium text-slate-700">
                  Intensidad
                </label>
                <select
                  id="symptom-intensity"
                  value={symptomIntensity}
                  onChange={(event) => setSymptomIntensity(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                >
                  <option>Leve</option>
                  <option>Moderada</option>
                  <option>Severa</option>
                </select>
              </div>

              <div>
                <label htmlFor="symptom-notes" className="block text-sm font-medium text-slate-700">
                  Notas adicionales
                </label>
                <textarea
                  id="symptom-notes"
                  value={symptomNotes}
                  onChange={(event) => setSymptomNotes(event.target.value)}
                  placeholder="Describe brevemente el malestar..."
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Guardar síntoma
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}