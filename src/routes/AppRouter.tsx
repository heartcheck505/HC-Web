import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout'
import { getUserPlan, isAuthenticated } from '../api/apiClient'
import LandingPage from '../views/LandingPage'
import Planes from '../views/Planes'
import Soporte from '../views/Soporte'
import DashboardBasico from '../views/dashboard/DashboardBasico'
import DashboardPremium from '../views/dashboard/DashboardPremium'
import RegistroSintomas from '../views/registro/RegistroSintomas'
import Pacientes from '../views/pacientes/Pacientes'
import Login from '../views/auth/Login'
import Register from '../views/auth/Register'

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/auth/login" replace />
  }
  return children
}

// El formulario de registro es exclusivo para usuarios nuevos sin sesión.
function GuestOnlyRoute({ children }: { children: ReactNode }) {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function PremiumRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/auth/login" replace />
  }
  if (getUserPlan() !== 'premium') {
    // Acceso restringido: el plan básico no incluye el panel Premium.
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{ upgradeRequired: true }}
      />
    )
  }
  return children
}

const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/planes', element: <Planes /> },
      { path: '/soporte', element: <Soporte /> },
    ],
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardBasico />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard-premium',
    element: (
      <PremiumRoute>
        <DashboardPremium />
      </PremiumRoute>
    ),
  },
  {
    path: '/registro',
    element: (
      <ProtectedRoute>
        <RegistroSintomas />
      </ProtectedRoute>
    ),
  },
  {
    path: '/pacientes',
    element: (
      <ProtectedRoute>
        <Pacientes />
      </ProtectedRoute>
    ),
  },
  { path: '/auth/login', element: <Login /> },
  {
    path: '/auth/register',
    element: (
      <GuestOnlyRoute>
        <Register />
      </GuestOnlyRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}