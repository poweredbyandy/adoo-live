#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION=""
SKIP_TESTS=false
ASSUME_YES=false
DRY_RUN=false
NO_WATCH=false

DEFAULT_REPO="poweredbyandy/adoo-live"

usage() {
  cat <<'EOF'
Uso: scripts/github-release.sh [opciones] [versión]

Prepara el release y lo genera en GitHub (tag v* → workflow Release → Release con binarios).

Requisitos: git y npm. GitHub CLI (gh) es opcional para vigilar el workflow.

Opciones:
  --skip-tests    No ejecuta npm test
  --yes, -y       Sin confirmación interactiva
  --dry-run       Vista previa sin cambios en git ni GitHub
  --no-watch      No espera a que termine el workflow en GitHub
  -h, --help      Muestra esta ayuda

Si no indicas versión, usa package.json.

Ejemplos:
  scripts/github-release.sh 1.0.0-beta.4
  scripts/github-release.sh --yes 1.0.0
  scripts/github-release.sh --dry-run
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --yes|-y)
      ASSUME_YES=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-watch)
      NO_WATCH=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Opción desconocida: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      VERSION="$1"
      shift
      ;;
  esac
done

GITHUB_REPO="$(node -e "
  const pkg = require('./package.json');
  const publish = pkg.build && pkg.build.publish;
  if (publish && publish.owner && publish.repo) {
    console.log(publish.owner + '/' + publish.repo);
  } else {
    console.log('${DEFAULT_REPO}');
  }
")"
GITHUB_REPO="${GITHUB_REPO//$'\n'/}"

if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "require('./package.json').version")"
  echo "Versión desde package.json: $VERSION"
fi

VERSION="${VERSION#v}"
TAG="v${VERSION}"
PRERELEASE=false
if [[ "$VERSION" == *-* ]]; then
  PRERELEASE=true
fi

if ! [[ "$VERSION" =~ ^[0-9]+(\.[0-9]+)*(-[0-9A-Za-z.]+)?$ ]]; then
  echo "Versión inválida: $VERSION" >&2
  exit 1
fi

HAS_GH=false
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  HAS_GH=true
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Este directorio no es un repositorio git." >&2
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Debes estar en la rama main (actual: ${BRANCH:-detached})." >&2
  exit 1
fi

if git status --porcelain | grep -q .; then
  echo "Hay cambios sin commitear. Commitea o guarda antes del release." >&2
  git status --short
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "El tag $TAG ya existe." >&2
  exit 1
fi

if [[ "$HAS_GH" == true ]] && gh release view "$TAG" --repo "$GITHUB_REPO" >/dev/null 2>&1; then
  echo "Ya existe un release en GitHub para $TAG." >&2
  exit 1
fi

if ! git diff --quiet origin/main..HEAD 2>/dev/null; then
  echo "main local no coincide con origin/main. Haz pull o push antes del release." >&2
  exit 1
fi

echo ""
echo "=== Release en GitHub: adoo IoT $TAG ==="
echo "Repositorio: $GITHUB_REPO"
echo ""

if [[ "$SKIP_TESTS" == false ]]; then
  echo "→ Ejecutando tests..."
  npm test
  echo ""
else
  echo "→ Tests omitidos (--skip-tests)"
  echo ""
fi

echo "→ Actualizando package.json a $VERSION..."
npm version "$VERSION" --no-git-tag-version --allow-same-version

echo ""
echo "→ Vista previa del changelog (desde commits):"
echo "----------------------------------------"
node -e "
const { buildChangelogSectionFromGit } = require('./scripts/lib/changelog-from-git');
process.stdout.write(buildChangelogSectionFromGit(process.argv[1]));
" "$VERSION"
echo ""
echo "----------------------------------------"
echo ""
echo "Pasos en GitHub:"
echo "  1. Commit de versión en main"
echo "  2. Tag $TAG → dispara workflow Release"
echo "  3. GitHub Actions: tests, binarios mac/linux/win"
echo "  4. Creación del release con artefactos y changelog"
echo "  5. Actualización de CHANGELOG.md en main"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry-run: no se ejecutaron cambios."
  git checkout -- package.json package-lock.json 2>/dev/null || true
  exit 0
fi

if [[ "$ASSUME_YES" == false ]]; then
  read -r -p "¿Generar release $TAG en GitHub? [y/N] " reply
  if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    echo "Cancelado. Revirtiendo package.json..."
    git checkout -- package.json package-lock.json 2>/dev/null || true
    exit 0
  fi
fi

git add package.json package-lock.json
git commit -m "[REL] odoo-kiosk: prepare release $TAG"

echo "→ Push a origin/main..."
git push origin main

echo "→ Creando tag $TAG..."
git tag "$TAG"

echo "→ Push del tag (inicia generación en GitHub)..."
git push origin "$TAG"

ACTIONS_URL="https://github.com/$GITHUB_REPO/actions/workflows/release.yml"
RELEASES_URL="https://github.com/$GITHUB_REPO/releases"
RELEASE_URL="https://github.com/$GITHUB_REPO/releases/tag/$TAG"

if [[ "$NO_WATCH" == true ]] || [[ "$HAS_GH" == false ]]; then
  echo ""
  if [[ "$HAS_GH" == false ]]; then
    echo "gh no está instalado o autenticado. El tag ya fue enviado; el release se generará en GitHub Actions."
    echo "Instala gh para vigilar el workflow: brew install gh && gh auth login"
    echo ""
  else
    echo "Tag enviado. El release se generará en GitHub Actions."
  fi
  echo "Actions: $ACTIONS_URL"
  echo "Releases: $RELEASES_URL"
  exit 0
fi

echo ""
echo "→ Esperando workflow Release en GitHub..."
sleep 3

RUN_ID=""
for _ in {1..30}; do
  RUN_ID="$(gh run list \
    --repo "$GITHUB_REPO" \
    --workflow Release \
    --limit 20 \
    --json databaseId,headBranch,event \
    --jq "[.[] | select(.headBranch == \"$TAG\" or .headBranch == \"refs/tags/$TAG\")][0].databaseId")"
  if [[ -n "$RUN_ID" && "$RUN_ID" != "null" ]]; then
    break
  fi
  sleep 2
done

if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "No se encontró el workflow Release para $TAG. Revisa Actions manualmente." >&2
  echo "$ACTIONS_URL"
  exit 1
fi

echo "→ Workflow run: $RUN_ID"
if ! gh run watch "$RUN_ID" --repo "$GITHUB_REPO" --exit-status; then
  echo "El workflow Release falló. Revisa los logs en GitHub Actions." >&2
  exit 1
fi

echo ""
echo "→ Verificando release en GitHub..."
for _ in {1..15}; do
  if gh release view "$TAG" --repo "$GITHUB_REPO" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! gh release view "$TAG" --repo "$GITHUB_REPO" >/dev/null 2>&1; then
  echo "El workflow terminó pero no se encontró el release $TAG." >&2
  exit 1
fi

RELEASE_URL="$(gh release view "$TAG" --repo "$GITHUB_REPO" --json url --jq .url)"
IS_PRERELEASE="$(gh release view "$TAG" --repo "$GITHUB_REPO" --json isPrerelease --jq .isPrerelease)"

echo ""
echo "Release generado en GitHub: $RELEASE_URL"
if [[ "$PRERELEASE" == true && "$IS_PRERELEASE" != "true" ]]; then
  echo "Nota: la versión parece pre-release pero GitHub no marcó el release como pre-release."
fi
