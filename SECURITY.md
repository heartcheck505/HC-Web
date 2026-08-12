# Security Policy

## Reporte de vulnerabilidades

Si descubres una vulnerabilidad de seguridad en HeartCheck Web o en su
integración con la API, te pedimos que la reportes de forma responsable:

- **Email**: soporte@heartcheck.cl (asunto: "Security report")
- **No** publiques el hallazgo en issues, PRs o foros públicos antes de que
  sea corregido.

Te pedimos incluir en el reporte:

- Descripción clara del problema y pasos para reproducirlo.
- Impacto estimado y versión afectada.
- Si es posible, una propuesta de mitigación.

## Política del repositorio

Este es un repositorio **público**. Está estrictamente prohibido publicar:

- Datos personales reales de pacientes, cuidadores o médicos (PII).
- Credenciales, tokens, claves API o secretos de cualquier tipo.
- Datos clínicos o de mediciones vinculables a una persona.

Cualquier material sensible publicado por accidente debe eliminarse del
historial completo de git (no basta con borrar el archivo del HEAD) y
notificarse a soporte@heartcheck.cl.

## Alcance de la seguridad en este frontend

- La autenticación usa JWT almacenado en `localStorage`. Para mitigar el
  riesgo de robo por XSS se recomienda migrar a cookies `httpOnly` + `Secure`
  (requiere cambios en el backend).
- La política CSP se inyecta en el build de producción (ver `vite.config.ts`).
  `frame-ancestors` y otros encabezados de seguridad deben configurarse en el
  servidor/hosting de despliegue.
