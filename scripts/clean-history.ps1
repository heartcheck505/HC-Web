# Limpieza de datos personales del historial git (PII).
#
# Clona el repositorio en modo espejo, reescribe TODO el historial con
# git-filter-repo reemplazando los patrones de datos sensibles, verifica que
# no queden restos y deja listo el push forzado.
#
# REQUISITOS:
#   - git
#   - git-filter-repo (pip install git-filter-repo | scoop install git-filter-repo | choco install git-filter-repo)
#
# USO:
#   powershell -ExecutionPolicy Bypass -File .\scripts\clean-history.ps1
#
# El script NO hace push: ese paso queda para que lo ejecutes manualmente
# con el comando que imprime al final.

param(
  [string]$RepoUrl = '',
  [string]$PatternsFile = '',
  [string]$WorkRoot = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) {
  Write-Host "`n==> $msg" -ForegroundColor Cyan
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $PatternsFile) {
  $PatternsFile = Join-Path $scriptDir 'redact-patterns.txt'
}

if (-not $RepoUrl) {
  $RepoUrl = git remote get-url origin
  if ($LASTEXITCODE -ne 0 -or -not $RepoUrl) {
    Write-Error 'No se pudo obtener el remote origin. Ejecuta con -RepoUrl "https://github.com/heartcheck505/HC-Web.git".'
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error 'git no está instalado.'
}

Write-Step "Verificando git-filter-repo..."
git filter-repo --version 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error @'
git-filter-repo no está disponible. Instálalo con uno de estos comandos:

  pip install git-filter-repo
  scoop install git-filter-repo
  choco install git-filter-repo

Luego vuelve a ejecutar este script.
'@
}

if (-not (Test-Path -LiteralPath $PatternsFile)) {
  Write-Error "No se encuentra el archivo de patrones: $PatternsFile"
}

if (-not $WorkRoot) {
  $WorkRoot = Join-Path $env:TEMP ('hc-history-clean-' + [guid]::NewGuid().ToString('N'))
}
New-Item -ItemType Directory -Path $WorkRoot -Force | Out-Null
$mirror = Join-Path $WorkRoot 'HC-Web-mirror.git'

Write-Step "Clonando espejo del repositorio: $RepoUrl"
git clone --mirror $RepoUrl $mirror
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Falló el clonado espejo.'
}

Push-Location $mirror
try {
  Write-Step 'Reescribiendo historial: reemplazo de datos sensibles en contenido y mensajes de commit...'
  git filter-repo `
    --replace-text $PatternsFile `
    --message-callback "message = message.replace('***REMOVED***','[REDACTED]').replace('***REMOVED***','[REDACTED]')" `
    --force
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Falló git filter-repo.'
  }

  Write-Step 'Verificando que no queden datos sensibles en el historial...'
  $patterns = @()
  foreach ($line in Get-Content -LiteralPath $PatternsFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed -match '^literal:(.+)$') {
      $patterns += [regex]::Escape($Matches[1])
    }
    elseif ($trimmed -match '^glob:(.+)$') {
      $patterns += $Matches[1].Replace('*', '.*')
    }
    else {
      $patterns += $trimmed
    }
  }

  $needle = $patterns -join '|'
  if ($needle) {
    $hits = git grep -n -E $needle (git rev-list --all) 2>$null
    if ($hits) {
      Write-Error "Aún quedan datos sensibles en el contenido del historial:`n$hits"
    }
  }

  $msgHits = git log --all --pretty=format:%B | Select-String -Pattern '***REMOVED***|***REMOVED***' -SimpleMatch
  if ($msgHits) {
    Write-Error "Aún quedan nombres en mensajes de commit:`n$msgHits"
  }

  Write-Step 'Agregando remote origin al espejo...'
  git remote add origin $RepoUrl
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'No se pudo agregar el remote origin.'
  }

  Write-Host ''
  Write-Host 'Historial limpio y verificado.' -ForegroundColor Green
  Write-Host "Espejo listo: $mirror"
}
finally {
  Pop-Location
}

Write-Host @'

================= INSTRUCCIONES (ejecuta tú, manualmente) =================

1) Fuerza el push del historial reescrito (sobrescribe TODO el historial):

   git -C "MIRROR" push origin --force --mirror

   (MIRROR = la ruta del espejo indicada arriba)

2) En tu repositorio local de trabajo, re-sincroniza con el nuevo historial:

   git fetch origin --prune
   git reset --hard origin/main

   (o simplemente clona de nuevo)

3) Limpieza local opcional del espejo:

   git -C "MIRROR" reflog expire --expire=now --all
   git -C "MIRROR" gc --prune=now --aggressive

4) IMPORTANTE después del push forzado:
   - PRs/issues abiertos basados en el historial antiguo quedarán rotos.
   - Cualquier colaborador con clones locales debe re-clonar o resetear.
   - Considera hacer el repositorio PRIVADO para minimizar la exposición
     del historial antiguo mientras GitHub lo purga.
   - Los SHAs antiguos pueden persistir en forks/clones externos: no se
     pueden eliminar de forma remota; la purga automática de GitHub toma
     tiempo.
============================================================================
'@
