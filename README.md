# HeartCheck Web

Plataforma web de telemetría cardíaca en tiempo real para el monitoreo
continuo de pacientes. SPA construida con React 19, TypeScript y Vite.

## Stack

- [React](https://react.dev) + [React Router](https://reactrouter.com)
- [Vite](https://vite.dev) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Oxlint](https://oxc.rs) (linting)

## Requisitos

- Node.js 22 (ver `.nvmrc`)

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Typecheck (`tsc -b`) + build de producción |
| `npm run lint` | Oxlint |
| `npm test` | Vitest (unit tests) |
| `npm run preview` | Previsualizar el build de producción |
| `npm audit` | Auditoría de vulnerabilidades de dependencias |

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores. Solo las variables
prefijadas con `VITE_` se exponen al cliente; úsalas únicamente para valores
no sensibles.

| Variable | Descripción |
| --- | --- |
| `VITE_API_BASE_URL` | URL absoluta de la API (solo HTTPS en producción). Por defecto `/api` |
| `VITE_USE_MOCK_DATA` | `true`/`false`: fuerza el uso de datos de prueba |
| `HEARTCHECK_API_PROXY_TARGET` | Destino del proxy `/api` en desarrollo (no expuesto al cliente) |

## Seguridad

- La API se consume con URL relativa (`/api`) para evitar Mixed Content.
- CSP inyectada en el build de producción (ver `vite.config.ts`).
- CI/CD: lint, tests, build, `npm audit`, Gitleaks y CodeQL (ver
  `.github/workflows`).
- Para reportar vulnerabilidades consulta [SECURITY.md](SECURITY.md).
