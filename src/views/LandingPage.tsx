import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Monitoreo continuo',
    description:
      'Telemetría cardíaca en tiempo real las 24 horas para la detección temprana de arritmias y eventos críticos.',
  },
  {
    title: 'Alertas inteligentes',
    description:
      'Alertas clasificadas por severidad cuando los signos vitales exceden los umbrales personalizados.',
  },
  {
    title: 'Multi-dispositivo',
    description:
      'Accede desde cualquier navegador o dispositivo móvil; el historial clínico siempre está disponible.',
  },
  {
    title: 'Seguridad y cumplimiento',
    description:
      'Autenticación JWT, cifrado en tránsito y control de acceso por roles para proteger la información del paciente.',
  },
]

export default function LandingPage() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 py-12 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Telemetría cardíaca en{' '}
            <span className="text-sky-600">tiempo real</span> para tu equipo
            médico
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Heart-Check centraliza el monitoreo continuo de tus pacientes:
            frecuencia cardíaca, saturación, presión arterial y alertas
            críticas, todo en un solo panel.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/auth/register"
              className="rounded-lg bg-sky-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
            >
              Crear cuenta
            </Link>
            <Link
              to="/planes"
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Ver planes
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Frecuencia cardíaca
              </p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                EN VIVO
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-slate-900">72</span>
              <span className="text-slate-500">lpm</span>
            </div>
            <svg
              className="mt-4 w-full text-sky-600"
              viewBox="0 0 400 80"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points="0,40 30,40 45,20 60,60 75,35 90,45 110,40 130,55 150,15 170,50 190,35 210,45 230,40 260,25 280,60 300,30 320,45 350,40 400,40"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">SpO₂</p>
                <p className="font-semibold text-slate-900">98%</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Presión</p>
                <p className="font-semibold text-slate-900">120/78</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Una plataforma, todos tus pacientes
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-sky-700 px-6 py-12 text-center shadow-lg">
        <h2 className="text-3xl font-bold text-white">
          Empieza a monitorear hoy mismo
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sky-100">
          Regístrate en minutos y conecta tus dispositivos de telemetría con el
          panel centralizado de Heart-Check.
        </p>
        <Link
          to="/auth/register"
          className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-medium text-sky-700 shadow-sm transition-colors hover:bg-sky-50"
        >
          Registrarse gratis
        </Link>
      </section>
    </div>
  )
}