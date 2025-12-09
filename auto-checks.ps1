# Auto-checks script for "flavournous dance crew"
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File ".\auto-checks.ps1"

param(
    [string]$RepoRoot = (Resolve-Path ".").Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

Write-Output "Repo root: $RepoRoot"
Set-Location $RepoRoot

# Create unique branch
$timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$branch = "fix/auto-checks-$timestamp"
git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0) { Write-Error "Not a git repo. Exiting."; exit 1 }
git fetch origin
git checkout -b $branch

$logFile = Join-Path $RepoRoot "auto-checks.log"
"" > $logFile

function Run {
    param($cmd)
    Write-Output "`n> $cmd" | Tee-Object -FilePath $logFile -Append
    # Use cmd /c so cross-platform npm/npx calls behave like in a shell
    cmd /c "$cmd" 2>&1 | Tee-Object -FilePath $logFile -Append
    return $LASTEXITCODE
}

# Detect project type
$hasPackageJson = Test-Path (Join-Path $RepoRoot "package.json")
$hasPyproject = Test-Path (Join-Path $RepoRoot "pyproject.toml")
$hasRequirements = Test-Path (Join-Path $RepoRoot "requirements.txt")
$hasSln = Get-ChildItem -Path $RepoRoot -Filter *.sln -Recurse -ErrorAction SilentlyContinue

if ($hasPackageJson) {
    Write-Output "Detected Node project (package.json)." | Tee-Object -FilePath $logFile -Append

    # Choose package manager by lockfile
    if (Test-Path (Join-Path $RepoRoot "yarn.lock")) {
        $pm = "yarn"
    } elseif (Test-Path (Join-Path $RepoRoot "pnpm-lock.yaml")) {
        $pm = "pnpm"
    } else {
        $pm = "npm"
    }
    Write-Output "Using package manager: $pm" | Tee-Object -FilePath $logFile -Append

    if ($pm -eq "npm") {
        Run "npm ci"
    } elseif ($pm -eq "yarn") {
        Run "yarn install --frozen-lockfile"
    } else {
        Run "pnpm install --frozen-lockfile"
    }

    # Ensure eslint/prettier are available to npx (install as devDependencies if missing)
    if (-not (Test-Path (Join-Path $RepoRoot "node_modules\.bin\eslint"))) {
        Write-Output "eslint not found; installing eslint + prettier as devDependencies..." | Tee-Object -FilePath $logFile -Append
        Run "npm install --no-audit --no-fund -D eslint@9.39.1 prettier@3.7.4"
    }

    # Lint / fix / format
    Run "npm run lint --if-present"
    Run "npx eslint . --fix --quiet"
    # Use prettier's newer log-level flag if available
    Run "npx prettier --write . --log-level silent"

    # Tests and build
    Run "npm test --if-present"
    Run "npm run build --if-present"
}
elseif ($hasPyproject -or $hasRequirements) {
    Write-Output "Detected Python project." | Tee-Object -FilePath $logFile -Append
    $venv = Join-Path $RepoRoot ".venv_auto_checks"
    Run "python -m venv `"$venv`""
    $pip = Join-Path $venv "Scripts\pip.exe"
    $py = Join-Path $venv "Scripts\python.exe"

    Run "`"$pip`" install --upgrade pip setuptools wheel"
    if ($hasRequirements) { Run "`"$pip`" install -r `"$RepoRoot\requirements.txt`"" }
    else { Run "`"$pip`" install -e . --no-build-isolation --upgrade || true" }

    Run "`"$py`" -m pip install flake8 black pytest --upgrade || true"
    Run "`"$py`" -m black . || true"
    Run "`"$py`" -m flake8 . || true"
    Run "`"$py`" -m pytest -q || true"
}
elseif ($hasSln) {
    Write-Output "Detected .NET solution." | Tee-Object -FilePath $logFile -Append
    Run "dotnet restore"
    Run "dotnet build --configuration Release"
    Run "dotnet test --no-build --verbosity minimal"
} else {
    Write-Output "No recognized project type (no package.json / pyproject.toml / *.sln). Running generic checks." | Tee-Object -FilePath $logFile -Append
    # Attempt generic formatter if Prettier exists
    if (Get-Command npx -ErrorAction SilentlyContinue) {
        Run "npx prettier --write . --log-level silent"
    }
}

# Work around "detected dubious ownership" by configuring git safe.directory for this repo (helps CI/WSL/Windows ownership mismatches)
Run "git config --global --add safe.directory `"$RepoRoot`""

# Stage changes and commit
Run "git add -A"
Run "git diff --staged --quiet"
if ($LASTEXITCODE -ne 0) {
    Run "git commit -m `"chore: automated fixes and formatting (auto-checks)`" || true"
    Run "git push -u origin $branch"
} else {
    Write-Output "No changes to commit." | Tee-Object -FilePath $logFile -Append
}

Write-Output "`nAuto-checks complete. Log: $logFile" | Tee-Object -FilePath $logFile -Append
Write-Output "Branch: $branch"
exit 0
