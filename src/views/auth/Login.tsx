import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Mail,
  UserRound,
  UserRoundCheck,
} from 'lucide-react'
import {
  API_ENDPOINTS,
  apiClient,
  ApiError,
  normalizeStoredUser,
  setStoredUser,
  tokenStorage,
} from '../../api/apiClient'
import type { LoginRequest, LoginResponse } from '../../types/auth.types'

type Role = 'cuidador' | 'usuario'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormErrors {
  email?: string
  password?: string
  form?: string
}

const roleTabs: { id: Role; label: string; icon: typeof UserRound }[] = [
  { id: 'cuidador', label: 'Cuidador', icon: UserRoundCheck },
  { id: 'usuario', label: 'Usuario Principal', icon: UserRound },
]

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const explicitRedirect = searchParams.get('redirect')

  const [activeRole, setActiveRole] = useState<Role>('cuidador')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    if (!email.trim()) {
      next.email = 'El correo electrónico es obligatorio.'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      next.email = 'Ingrese un correo electrónico válido.'
    }
    if (!password) {
      next.password = 'La contraseña es obligatoria.'
    }
    return next
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const validation = validate()
    setErrors(validation)
    if (Object.keys(validation).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      const payload: LoginRequest = {
        email: email.trim(),
        password,
      }
      const response = await apiClient.post<LoginResponse>(
        API_ENDPOINTS.auth.login,
        payload,
        { skipAuthRedirect: true },
      )
      tokenStorage.set(response.token)
      const sessionUser =
        normalizeStoredUser(response) ??
        normalizeStoredUser({ email: email.trim() })
      if (!sessionUser) {
        setErrors({
          form:
            'No se pudo recuperar el perfil de la cuenta. Intente nuevamente.',
        })
        return
      }
      setStoredUser(sessionUser)
      // Ruta inicial según licencia: Premium → /dashboard-premium,
      // Básico → /dashboard (a menos que exista una redirección explícita).
      const defaultRoute =
        sessionUser.plan === 'premium' ? '/dashboard-premium' : '/dashboard'
      navigate(explicitRedirect ?? defaultRoute, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({
          form:
            error.status === 401
              ? 'Credenciales incorrectas. Verifique su correo y contraseña.'
              : error.message,
        })
      } else {
        setErrors({ form: 'Ocurrió un error inesperado. Intente nuevamente.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase =
    'w-full rounded-lg border border-slate-300 py-2.5 pl-11 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20'

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link to="/" className="inline-flex items-center gap-2 self-start">
          <span className="flex size-9 items-center justify-center rounded-full bg-blue-600">
            <HeartPulse className="size-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Heart-Check
          </span>
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold text-blue-950">Inicia sesión</h1>
          <p className="mt-2 text-slate-500">
            Tu tranquilidad es nuestra prioridad. Monitorea la salud de tus
            seres queridos con seguridad y precisión.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {roleTabs.map((tab) => {
              const isActive = activeRole === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveRole(tab.id)}
                  aria-pressed={isActive}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="size-4 shrink-0" aria-hidden="true" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {errors.form && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {errors.form}
            </div>
          )}

          <form
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
            className="mt-6 space-y-5"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputBase}
                  placeholder="nombre@ejemplo.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>
              <div className="relative mt-1.5">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputBase}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="size-4 rounded border-slate-300 accent-blue-600"
                />
                Recordarme
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Olvidé mi contraseña
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Ingresando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            ¿No tienes una cuenta?{' '}
            <Link
              to="/auth/register"
              className="font-semibold text-blue-600 hover:underline"
            >
              Crear cuenta
            </Link>
          </p>

          <p className="mt-10 text-center text-xs text-slate-400">
            Heart-Check no sustituye una valoración médica.
          </p>
        </div>
      </div>

      <div className="relative hidden h-screen overflow-hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=80"
          alt="Profesional de la salud monitoreando signos vitales"
          className="h-screen w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-slate-900/10"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-12 px-10">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold tracking-wider text-white">
              <HeartPulse className="size-4" aria-hidden="true" />
              ACOMPAÑAMIENTO HUMANO
            </span>
            <h2 className="mt-5 text-3xl font-bold text-white">
              Monitoreo en cada latido
            </h2>
            <p className="mt-3 max-w-lg text-white/80">
              Nuestra tecnología está diseñada para mantenerte conectado con tus
              seres queridos, brindando datos precisos y alertas en tiempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}