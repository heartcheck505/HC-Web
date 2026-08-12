import { useCallback, useEffect, useState } from 'react'
import { API_ENDPOINTS, apiClient, shouldUseMockData } from '../api/apiClient'
import type { Alert, AlertSeverity } from '../types/alert.types'
import type { MeasurementSummary } from '../types/measurement.types'
import type { Patient, PagedResult } from '../types/patient.types'

interface DashboardState {
  summary: MeasurementSummary | null
  patientTotal: number
  alerts: Alert[]
}

interface SeverityStyles {
  badge: string
  dot: string
}

const severityStyles: Record<AlertSeverity, SeverityStyles> = {
  Critical: { badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  Warning: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  Info: { badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    summary: null,
    patientTotal: 0,
    alerts: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (shouldUseMockData()) {
      setState({
        summary: null,
        patientTotal: 0,
        alerts: [],
      })
      setLoading(false)
      return
    }

    const [summaryResult, patientsResult, alertsResult] = await Promise.allSettled([
      apiClient.get<MeasurementSummary>(API_ENDPOINTS.measurements.summary),
      apiClient.get<PagedResult<Patient>>(
        `${API_ENDPOINTS.patients.list}?page=1&pageSize=1`,
      ),
      apiClient.get<Alert[]>(
        `${API_ENDPOINTS.alerts.list}?status=Active&pageSize=10`,
      ),
    ])

    const summary =
      summaryResult.status === 'fulfilled' ? summaryResult.value : null
    const patientTotal =
      patientsResult.status === 'fulfilled' ? patientsResult.value.totalItems : 0
    const alerts =
      alertsResult.status === 'fulfilled' && Array.isArray(alertsResult.value)
        ? alertsResult.value
        : []

    const failures = [summaryResult, patientsResult, alertsResult].filter(
      (
        result,
      ): result is { status: 'rejected'; reason: unknown } =>
        result.status === 'rejected',
    )

    if (failures.length > 0) {
      setError(
        'No fue posible cargar parte de los datos desde el servidor. Verifique que la API responda correctamente.',
      )
    }

    setState({ summary, patientTotal, alerts })
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-slate-500">Cargando panel de telemetría…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Panel de monitoreo
          </h1>
          <p className="mt-1 text-slate-600">
            Resumen en tiempo real del estado de tus pacientes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Recargar
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {error}
        </div>
      )}

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pacientes activos</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">
            {state.patientTotal}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Frecuencia cardíaca</p>
          {state.summary?.latestHeartRate !== null &&
          state.summary?.latestHeartRate !== undefined ? (
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900">
                {state.summary.latestHeartRate}
              </span>
              <span className="text-slate-500">lpm</span>
            </div>
          ) : (
            <p className="mt-2 text-slate-500">Sin datos aún</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Alertas activas</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">
            {state.alerts.length}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900">Alertas recientes</h2>
        {state.alerts.length === 0 ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            No hay alertas activas. Todo está bajo control.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {state.alerts.map((alert) => {
              const styles = severityStyles[alert.severity]
              return (
                <li
                  key={alert.id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${styles.dot}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {alert.patientName}
                    </p>
                    <p className="truncate text-sm text-slate-600">
                      {alert.message}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}
                  >
                    {alert.severity}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatDate(alert.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
