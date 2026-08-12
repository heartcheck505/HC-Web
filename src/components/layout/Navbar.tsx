import { Link, NavLink, useNavigate } from 'react-router-dom'
import { clearSession, getStoredUser, isAuthenticated } from '../../api/apiClient'

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-sky-600 text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-sky-700'
  }`

export default function Navbar() {
  const navigate = useNavigate()
  const authenticated = isAuthenticated()
  const user = getStoredUser()
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : null

  const handleLogout = (): void => {
    clearSession()
    navigate('/auth/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-sky-600">
            <svg
              className="size-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 4c1.5 1.5 2 3 2 4.5s-.5 3-2 4.5l-7 7-7-7C1.5 11.5 1 10 1 8.5S1.5 5.5 3 4s3-1 4.5 1l-3 3L12 15.5l5.5-5.5-3-3C16 3.5 17.5 2.5 19 4Z" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Heart-Check
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={navLinkClass}>
            Inicio
          </NavLink>
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/planes" className={navLinkClass}>
            Planes
          </NavLink>
          <NavLink to="/soporte" className={navLinkClass}>
            Soporte
          </NavLink>
        </div>

        <div className="flex items-center gap-3">
          {authenticated ? (
            <>
              {displayName && (
                <span className="hidden max-w-40 truncate text-sm font-medium text-slate-600 sm:block">
                  Hola, {displayName}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link
              to="/auth/login"
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
