import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  FileText,
  FlaskConical,
  HeartPulse,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import {
  clearSession,
  getStoredUser,
  getUserPlan,
  setUserPlan,
} from '../../api/apiClient'
import PlanChangeModal from '../plan/PlanChangeModal'
import type { UserPlan } from '../../types/auth.types'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { label: 'Registro', to: '/registro', icon: FileText },
  { label: 'Pacientes', to: '/pacientes', icon: Users },
]

const basicDashboardNavItem: NavItem = {
  label: 'Dashboard',
  to: '/dashboard',
  icon: LayoutDashboard,
}

const premiumNavItem: NavItem = {
  label: 'Dashboard Premium',
  to: '/dashboard-premium',
  icon: Sparkles,
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const user = getStoredUser()
  const [plan, setPlan] = useState<UserPlan>(() => getUserPlan())
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const isPremium = plan === 'premium'

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'Usuario invitado'
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'UI'

  const handleLogout = (): void => {
    clearSession()
    navigate('/auth/login', { replace: true })
  }

  const handlePlanChange = (nextPlan: UserPlan): void => {
    setUserPlan(nextPlan)
    setPlan(nextPlan)
    if (nextPlan === 'premium' && location.pathname !== '/dashboard-premium') {
      navigate('/dashboard-premium')
      return
    }
    if (nextPlan === 'basic' && location.pathname === '/dashboard-premium') {
      navigate('/dashboard', { replace: true, state: { upgradeRequired: true } })
    }
  }

  const handleUpgradeConfirmed = (): void => {
    setUserPlan('premium')
    setPlan('premium')
    setUpgradeOpen(false)
    navigate('/dashboard-premium')
  }

  const visibleNavItems = isPremium
    ? [premiumNavItem, ...navItems]
    : [basicDashboardNavItem, ...navItems]

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
      <Link to="/" className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-blue-600">
          <HeartPulse className="size-5 text-white" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Heart-Check
        </span>
      </Link>

      <nav className="mt-10 space-y-1.5" aria-label="Menú principal">
        {visibleNavItems.map((item) => {
          const active = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-100/60 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700'
              }`}
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}

        {!isPremium && (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="mt-3 flex w-full items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            <Star className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
            Actualizar a Premium
            <ArrowUpRight
              className="ml-auto size-4 shrink-0 text-amber-500"
              aria-hidden="true"
            />
          </button>
        )}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <FlaskConical className="size-3.5" aria-hidden="true" />
            Simulador de plan
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handlePlanChange('basic')}
              aria-pressed={!isPremium}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                !isPremium
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-500 hover:text-slate-700'
              }`}
            >
              Básico
            </button>
            <button
              type="button"
              onClick={() => handlePlanChange('premium')}
              aria-pressed={isPremium}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                isPremium
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-500 hover:text-blue-700'
              }`}
            >
              Premium
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {displayName}
            </p>
            <p className="text-xs text-slate-500">
              {isPremium ? 'Plan Premium' : 'Plan Básico'}
            </p>
          </div>
        </div>

        <nav className="space-y-1.5" aria-label="Menú secundario">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
            Ayuda
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Cerrar Sesión
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Settings className="size-4 shrink-0" aria-hidden="true" />
            Settings
          </button>
        </nav>
      </div>

      <PlanChangeModal
        open={upgradeOpen}
        mode="upgrade"
        planName="Premium"
        price="$19.99"
        onClose={() => setUpgradeOpen(false)}
        onConfirmed={handleUpgradeConfirmed}
      />
    </aside>
  )
}