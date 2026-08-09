import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  FileText,
  HeartPulse,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react'
import { clearSession, getStoredUser } from '../../api/apiClient'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Registro', to: '/registro', icon: FileText },
  { label: 'Pacientes', to: '/pacientes', icon: Users },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const user = getStoredUser()
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
        {navItems.map((item) => {
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
      </nav>

      <div className="mt-auto space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {displayName}
            </p>
            <p className="text-xs text-slate-500">Plan Básico</p>
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
    </aside>
  )
}