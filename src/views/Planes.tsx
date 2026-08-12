import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getCurrentUserPlan,
  getPlans,
  getUserPlan,
  isAuthenticated,
  setUserPlan,
  subscribeToPlan,
} from '../api/apiClient'
import PlanChangeModal from '../components/plan/PlanChangeModal'
import type { Plan, UserPlanSubscription } from '../types/plan.types'
import type { UserPlan } from '../types/auth.types'

type FeatureIcon = 'check' | 'cross' | 'star'

interface Feature {
  text: string
  icon: FeatureIcon
}

interface PlanCardProps {
  planId: string
  name: string
  tagline: string
  price: string
  priceSubClass: string
  cardClass: string
  badge?: string
  badgeClass?: string
  titleClass: string
  taglineClass: string
  features: Feature[]
  iconClass: string
  itemTextClass: string
  ctaLabel: string
  ctaClass: string
}

interface ComparisonRow {
  label: string
  basic: string | null
  premium: string | null
  gold: string | null
}

function renderIcon(icon: FeatureIcon, className: string) {
  if (icon === 'cross') {
    return (
      <svg
        className={`size-5 shrink-0 text-rose-400 ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </svg>
    )
  }
  if (icon === 'star') {
    return (
      <svg
        className={`size-5 shrink-0 ${className}`}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    )
  }
  return (
    <svg
      className={`size-5 shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

const plans: PlanCardProps[] = [
  {
    planId: 'basico',
    name: 'Básico',
    tagline: 'Para un seguimiento preventivo esencial.',
    price: '$0',
    priceSubClass: 'text-slate-500',
    cardClass: 'bg-white border border-slate-200 shadow-sm',
    titleClass: 'text-slate-900',
    taglineClass: 'text-slate-600',
    features: [
      { text: 'Monitoreo básico', icon: 'check' },
      { text: 'Registro manual de síntomas', icon: 'check' },
      { text: 'Bitácora de 30 días', icon: 'check' },
      { text: '1 dispositivo', icon: 'check' },
      { text: 'Análisis de tendencias', icon: 'cross' },
      { text: 'Exportación de reportes PDF', icon: 'cross' },
    ],
    iconClass: 'text-sky-500',
    itemTextClass: 'text-slate-700',
    ctaLabel: 'Seleccionar',
    ctaClass: 'bg-sky-100 text-sky-700 hover:bg-sky-200',
  },
  {
    planId: 'premium',
    name: 'Premium',
    tagline: 'Seguimiento integral.',
    price: '$19.99',
    priceSubClass: 'text-sky-200',
    cardClass:
      'bg-gradient-to-b from-blue-700 to-blue-800 border border-blue-600 shadow-xl relative',
    badge: 'RECOMENDADO',
    badgeClass: 'bg-white text-blue-700',
    titleClass: 'text-white',
    taglineClass: 'text-sky-200',
    features: [
      { text: 'Monitoreo completo 24/7', icon: 'check' },
      { text: 'Registro automático de síntomas', icon: 'check' },
      { text: 'Bitácora de 6 meses', icon: 'check' },
      { text: '3 dispositivos', icon: 'check' },
      { text: 'Alertas preventivas', icon: 'check' },
    ],
    iconClass: 'text-sky-300',
    itemTextClass: 'text-white',
    ctaLabel: 'Seleccionar Premium',
    ctaClass: 'bg-white text-blue-700 hover:bg-blue-50',
  },
  {
    planId: 'gold',
    name: 'Gold',
    tagline: 'Monitoreo avanzado y dispositivos ilimitados.',
    price: '$49.99',
    priceSubClass: 'text-sky-300',
    cardClass: 'bg-slate-950 border border-slate-700 shadow-lg',
    titleClass: 'text-white',
    taglineClass: 'text-slate-300',
    features: [
      { text: 'Monitoreo avanzado', icon: 'star' },
      { text: 'Dispositivos ilimitados', icon: 'star' },
      { text: 'Alertas preventivas y prioritarias', icon: 'star' },
      { text: 'Análisis de tendencias semanal', icon: 'star' },
      { text: 'Exportación completa', icon: 'star' },
    ],
    iconClass: 'text-sky-400',
    itemTextClass: 'text-white',
    ctaLabel: 'Seleccionar Gold',
    ctaClass: 'bg-sky-400 text-slate-900 hover:bg-sky-300',
  },
]

const comparisonRows: ComparisonRow[] = [
  {
    label: 'Dispositivos vinculados',
    basic: '1',
    premium: '3',
    gold: 'Ilimitados',
  },
  {
    label: 'Historial de Bitácora',
    basic: '30 días',
    premium: '6 meses',
    gold: 'Ilimitado',
  },
  {
    label: 'Alertas prioritarias',
    basic: '✕',
    premium: '✓',
    gold: '✓',
  },
  {
    label: 'Soporte Multi-usuario',
    basic: '✕',
    premium: '✕',
    gold: '✓',
  },
]

function ComparisonIcon({ value }: { value: string | null }) {
  if (value === '✓') {
    return <span className="font-semibold text-emerald-500">✓</span>
  }
  if (value === '✕') {
    return <span className="font-semibold text-rose-500">✕</span>
  }
  return <span className="text-slate-700">{value}</span>
}

interface PlanChangeState {
  mode: 'upgrade' | 'downgrade'
  planId: string
  planName: string
  price: string
  userPlan: UserPlan
}

function planIdToUserPlan(planId: string): UserPlan {
  return planId === 'basico' ? 'basic' : 'premium'
}

/**
 * Resuelve el `planId` de la API de producción correspondiente al plan local
 * (`basico`/`premium`/`gold`). Coincide primero por id exacto y luego por
 * nombre (o `keywords`) del catálogo devuelto por `GET /api/plans`.
 */
function resolveBackendPlanId(uiPlanId: string, plans: Plan[]): string | null {
  const keywords =
    uiPlanId === 'basico'
      ? ['basico', 'basic', 'básico']
      : uiPlanId === 'premium'
        ? ['premium']
        : ['gold']

  const matchesKeyword = (value: string | null | undefined): boolean =>
    keywords.some((keyword) => (value ?? '').toLowerCase().includes(keyword))

  const byId = plans.find(
    (plan) => plan.id.toLowerCase() === uiPlanId.toLowerCase(),
  )
  if (byId) {
    return byId.id
  }
  const byName = plans.find(
    (plan) =>
      matchesKeyword(plan.name) ||
      (plan.keywords ?? []).some((keyword) => matchesKeyword(keyword)),
  )
  return byName?.id ?? null
}

/**
 * Deriva la licencia local (`basic`/`premium`) desde la suscripción devuelta
 * por `GET /api/user-plans/me`. Si el backend no aporta nombre de plan, se
 * conserva la elección del usuario.
 */
function resolveSessionPlan(
  subscription: UserPlanSubscription | null,
  fallback: UserPlan,
): UserPlan {
  const planName = (
    subscription?.planName ??
    subscription?.plan?.name ??
    ''
  ).toLowerCase()
  if (planName.includes('gold') || planName.includes('premium')) {
    return 'premium'
  }
  if (
    planName.includes('básico') ||
    planName.includes('basico') ||
    planName.includes('basic')
  ) {
    return 'basic'
  }
  return fallback
}

export default function Planes() {
  const navigate = useNavigate()
  const authenticated = isAuthenticated()
  const currentPlan = getUserPlan()
  const [changeModal, setChangeModal] = useState<PlanChangeState | null>(null)
  const [backendPlans, setBackendPlans] = useState<Plan[]>([])

  useEffect(() => {
    if (!isAuthenticated()) {
      return
    }
    let cancelled = false
    getPlans()
      .then((plans) => {
        if (!cancelled) {
          setBackendPlans(Array.isArray(plans) ? plans : [])
        }
      })
      .catch(() => {
        // Backend inactivo: el flujo de cambio de plan persiste solo en local.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handlePlanConfirmed = async (): Promise<void> => {
    if (!changeModal) {
      return
    }
    const backendPlanId = resolveBackendPlanId(
      changeModal.planId,
      backendPlans,
    )
    if (isAuthenticated() && backendPlanId) {
      try {
        await subscribeToPlan(backendPlanId)
        const subscription = await getCurrentUserPlan()
        setUserPlan(resolveSessionPlan(subscription, changeModal.userPlan))
      } catch {
        // Backend inactivo o sin autorización: se persiste la licencia en local.
        setUserPlan(changeModal.userPlan)
      }
    } else {
      setUserPlan(changeModal.userPlan)
    }
    setChangeModal(null)
    navigate(
      changeModal.userPlan === 'premium' ? '/dashboard-premium' : '/dashboard',
    )
  }

  return (
    <div className="py-10">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <div className="rounded-2xl border-2 border-dashed border-sky-300 px-6 py-8">
          <h1 className="text-4xl font-bold text-blue-900">Selecciona tu plan</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-500">
            Elige el nivel de monitoreo que mejor se adapte a tu seguimiento y
            obtén la tranquilidad que tú y tu familia necesitan.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 px-4 md:grid-cols-3">
        {plans.map((plan) => {
          const targetPlan = planIdToUserPlan(plan.planId)
          const isCurrentPlan = authenticated && currentPlan === targetPlan
          const isUpgradeTarget = targetPlan === 'premium'

          const ctaButton = isCurrentPlan ? (
            <span
              className={`mt-8 rounded-lg px-4 py-2.5 text-center font-semibold opacity-60 ${plan.ctaClass}`}
            >
              Tu plan actual
            </span>
          ) : (
            <button
              type="button"
              onClick={() =>
                setChangeModal({
                  mode: isUpgradeTarget ? 'upgrade' : 'downgrade',
                  planId: plan.planId,
                  planName: plan.name,
                  price: plan.price,
                  userPlan: targetPlan,
                })
              }
              className={`mt-8 rounded-lg px-4 py-2.5 text-center font-semibold transition-colors ${plan.ctaClass}`}
            >
              {isUpgradeTarget ? `Actualizar a ${plan.name}` : 'Cambiar a Básico'}
            </button>
          )

          return (
            <div
              key={plan.planId}
              className={`flex flex-col rounded-2xl p-6 ${plan.cardClass}`}
            >
              {plan.badge && (
                <span
                  className={`absolute right-6 top-6 rounded-full px-3 py-1 text-xs font-semibold ${plan.badgeClass}`}
                >
                  {plan.badge}
                </span>
              )}
              <h2 className={`text-xl font-bold ${plan.titleClass}`}>{plan.name}</h2>
              <p className={`mt-1 text-sm ${plan.taglineClass}`}>{plan.tagline}</p>
              <p className="mt-5">
                <span className={`text-4xl font-extrabold ${plan.titleClass}`}>
                  {plan.price}
                </span>
                <span className={`text-base font-medium ${plan.priceSubClass}`}>
                  /mes
                </span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature.text}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    {renderIcon(feature.icon, plan.iconClass)}
                    <span className={plan.itemTextClass}>{feature.text}</span>
                  </li>
                ))}
              </ul>
              {authenticated ? (
                ctaButton
              ) : (
                <Link
                  to={`/auth/register?plan=${plan.planId}`}
                  className={`mt-8 rounded-lg px-4 py-2.5 text-center font-semibold transition-colors ${plan.ctaClass}`}
                >
                  {plan.ctaLabel}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-blue-50/50 p-6 sm:p-8">
          <h2 className="text-center text-2xl font-bold text-blue-900">
            Comparativa Detallada
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Conoce exactamente qué incluye cada plan antes de decidirte.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-blue-200 text-left">
                  <th className="py-3 pr-4 font-medium text-slate-500">
                    Característica
                  </th>
                  <th className="py-3 pr-4 font-semibold text-slate-700">
                    Básico
                  </th>
                  <th className="py-3 pr-4 font-bold text-blue-700">Premium</th>
                  <th className="py-3 font-bold text-blue-700">Gold</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-blue-100 last:border-0"
                  >
                    <td className="py-4 pr-4 font-medium text-slate-600">
                      {row.label}
                    </td>
                    <td className="py-4 pr-4">
                      <ComparisonIcon value={row.basic} />
                    </td>
                    <td className="py-4 pr-4">
                      <span className="font-semibold text-blue-700">
                        <ComparisonIcon value={row.premium} />
                      </span>
                    </td>
                    <td className="py-4">
                      <span className="font-semibold text-blue-700">
                        <ComparisonIcon value={row.gold} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <PlanChangeModal
        open={changeModal !== null}
        mode={changeModal?.mode ?? 'upgrade'}
        planName={changeModal?.planName ?? 'Premium'}
        price={changeModal?.price ?? '$19.99'}
        onClose={() => setChangeModal(null)}
        onConfirmed={handlePlanConfirmed}
      />
    </div>
  )
}