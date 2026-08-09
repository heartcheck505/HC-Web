import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
  FileDown,
  Headset,
  Lock,
  Shield,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type SidebarTab = 'faq' | 'privacidad' | 'contacto'

interface SidebarItem {
  id: SidebarTab
  label: string
  icon: LucideIcon
}

interface FaqItem {
  question: string
  answer: string
}

interface FaqSection {
  title: string
  items: FaqItem[]
}

const sidebarItems: SidebarItem[] = [
  { id: 'faq', label: 'Preguntas Frecuentes', icon: CircleHelp },
  { id: 'privacidad', label: 'Política de Privacidad', icon: Shield },
  { id: 'contacto', label: 'Contactar Soporte', icon: Headset },
]

const faqSections: FaqSection[] = [
  {
    title: 'Vinculación de Dispositivos',
    items: [
      {
        question: '¿Cómo vinculo mi smartwatch?',
        answer:
          'Para vincular tu dispositivo, abre la app CareConnect en tu smartphone, ve a Configuración > Dispositivos y sigue el flujo de emparejamiento. Asegúrate de tener Bluetooth activado y batería suficiente en ambos equipos.',
      },
      {
        question: '¿Qué dispositivos son compatibles?',
        answer:
          'Soportamos actualmente Apple Watch (Series 4+), Garmin Venu/Fenix, Samsung Galaxy Watch (4+) y otros relojes inteligentes con Wear OS 3 o superior.',
      },
    ],
  },
  {
    title: 'Alertas y Notificaciones',
    items: [
      {
        question: '¿Qué significan los niveles de alerta?',
        answer:
          'Verde: Signos vitales dentro del rango normal. Naranja/Rojo: Anomalías críticas que requieren atención inmediata.',
      },
    ],
  },
]

const quickAccess: { label: string; to: string }[] = [
  { label: 'Planes y Suscripciones', to: '/planes' },
  { label: 'Reportes de Salud', to: '/dashboard' },
  { label: 'Pagos y Facturación', to: '/planes' },
]

const securityCards: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Lock,
    title: 'AES-256',
    description: 'Estándar militar de encriptación para proteger tu información.',
  },
  {
    icon: Shield,
    title: 'HIPAA Ready',
    description: 'Cumplimiento de marcos internacionales de protección de datos.',
  },
  {
    icon: Database,
    title: 'Auditoría 24/7',
    description: 'Monitoreo constante contra accesos no autorizados.',
  },
]

export default function Soporte() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('faq')
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setContactOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleTab = (tab: SidebarTab): void => {
    setActiveTab(tab)
    if (tab === 'contacto') {
      setContactOpen(true)
      return
    }
    document.getElementById(tab)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const toggleQuestion = (question: string): void => {
    setOpenQuestion((current) => (current === question ? null : question))
  }

  const handleDownloadPdf = (): void => {
    const content =
      'Heart-Check — Política de Privacidad\n\nProtegemos tus datos de salud mediante encriptación de extremo a extremo.\nÚltima actualización: 12 de Octubre, 2023\n'
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'politica-privacidad-heartcheck.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-blue-600 px-4 py-16 text-center">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-white sm:text-4xl">
          Centro de Transparencia y Ayuda
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/80">
          Tu tranquilidad es nuestra prioridad. Encuentra respuestas rápidas y
          conoce cómo protegemos tus datos de salud.
        </p>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row">
          <aside className="w-full md:w-1/4">
            <nav className="space-y-2 md:sticky md:top-24">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <item.icon className="size-5 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="w-full space-y-12 md:w-3/4">
            <section id="faq" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-slate-900">
                Preguntas Frecuentes
              </h2>
              {faqSections.map((section) => (
                <div key={section.title}>
                  <h3 className="mt-6 text-lg font-semibold text-blue-800">
                    {section.title}
                  </h3>
                  <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                    {section.items.map((item) => {
                      const isOpen = openQuestion === item.question
                      return (
                        <div key={item.question}>
                          <button
                            type="button"
                            onClick={() => toggleQuestion(item.question)}
                            aria-expanded={isOpen}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                          >
                            <span className="font-medium text-slate-800">
                              {item.question}
                            </span>
                            <ChevronDown
                              className={`size-5 shrink-0 text-sky-600 transition-transform duration-300 ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                          {isOpen && (
                            <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">
                              {item.answer}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {quickAccess.map((card) => (
                  <Link
                    key={card.label}
                    to={card.to}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors hover:border-sky-300"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {card.label}
                    </span>
                    <ArrowRight
                      className="size-5 shrink-0 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-sky-600"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </section>

            <section id="privacidad" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-slate-900">
                Política de Privacidad
              </h2>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-blue-800">
                  Tratamiento de Datos de Salud
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Recopilamos tus datos biométricos únicamente con el propósito
                  de brindar monitoreo continuo y alertas oportunas. Toda la
                  información se maneja bajo los más altos estándares de
                  seguridad:
                </p>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-start gap-3 text-sm text-slate-700">
                    <Check
                      className="mt-0.5 size-5 shrink-0 text-sky-500"
                      aria-hidden="true"
                    />
                    Encriptación de extremo a extremo en el almacenamiento de
                    datos biométricos.
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-700">
                    <Check
                      className="mt-0.5 size-5 shrink-0 text-sky-500"
                      aria-hidden="true"
                    />
                    Acceso restringido: solo el usuario y sus contactos
                    autorizados pueden ver los reportes detallados.
                  </li>
                </ul>

                <h3 className="mt-8 text-lg font-semibold text-blue-800">
                  Consentimiento Informado
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Tienes el derecho a revocar tu consentimiento de tratamiento
                  de datos en cualquier momento. Al hacerlo, tus datos
                  biométricos dejarán de procesarse y serán eliminados o
                  anonimizados conforme a la legislación vigente.
                </p>

                <h3 className="mt-8 text-lg font-semibold text-blue-800">
                  Seguridad de la Información
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {securityCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center"
                    >
                      <card.icon
                        className="mx-auto size-8 text-sky-600"
                        aria-hidden="true"
                      />
                      <p className="mt-3 font-semibold text-slate-900">
                        {card.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {card.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
                  <p className="text-xs text-slate-500">
                    Última actualización: 12 de Octubre, 2023
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700"
                  >
                    <FileDown className="size-4" aria-hidden="true" />
                    Descargar PDF Completo
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {contactOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setContactOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="contact-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Contactar Soporte
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Nuestro equipo está listo para ayudarte.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <p className="rounded-lg bg-blue-50 px-4 py-3 text-blue-800">
                Email:{' '}
                <a
                  href="mailto:soporte@heartcheck.cl"
                  className="font-medium underline"
                >
                  soporte@heartcheck.cl
                </a>
              </p>
              <p className="rounded-lg bg-blue-50 px-4 py-3 text-blue-800">
                Horario de atención: Lunes a Viernes, 9:00–20:00 (GMT-3)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setContactOpen(false)}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}