#!/usr/bin/env bash
# Release a new version of advanced-entity-selector-card for HACS.
#
# Steps:
#   1. Bump version in package.json + src/const.ts (skipped if already set)
#   2. Build dist/
#   3. Tag v<version>
#   4. Push main + tag
#   5. Create GitHub release with the built bundle attached
#
# Usage: scripts/release.sh <version> [--yes]
#   --yes / -y   skip confirmation prompts (use only in CI / when sure)

set -euo pipefail

VERSION="${1:-}"
YES=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version> [--yes]" >&2
  echo "Example: $0 0.3.1" >&2
  exit 2
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: '$VERSION' is not valid semver (e.g. 0.3.1)" >&2
  exit 2
fi

TAG="v$VERSION"
cd "$(git rev-parse --show-toplevel)"

step()    { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()      { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
fail()    { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }
confirm() {
  [[ $YES -eq 1 ]] && return 0
  read -r -p "$1 [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

# ── Preconditions ──────────────────────────────────────────────────────────
step "Checking preconditions"

command -v gh >/dev/null || fail "gh CLI not installed (brew install gh)"
gh auth status >/dev/null 2>&1 || fail "gh not authenticated (gh auth login)"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" == "main" ]] || fail "not on main (on '$BRANCH')"

if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  fail "working tree has uncommitted tracked changes"
fi

git rev-parse "$TAG" >/dev/null 2>&1 && fail "tag $TAG already exists locally"

git fetch origin --tags --quiet
git ls-remote --tags origin "$TAG" | grep -q "refs/tags/$TAG" \
  && fail "tag $TAG already exists on origin"

REMOTE=$(git rev-parse origin/main)
BASE=$(git merge-base HEAD origin/main)
[[ "$BASE" == "$REMOTE" ]] || fail "local main has diverged from origin/main"

ok "preconditions passed"

# ── Version bump ───────────────────────────────────────────────────────────
CURRENT_PKG=$(npm pkg get version | tr -d '"')
CURRENT_CONST=$(grep -oE "VERSION = '[^']+'" src/const.ts | sed "s/VERSION = '//;s/'//")

if [[ "$CURRENT_PKG" == "$VERSION" && "$CURRENT_CONST" == "$VERSION" ]]; then
  step "Version already at $VERSION in package.json and src/const.ts — skipping bump"
elif [[ "$CURRENT_PKG" == "$VERSION" || "$CURRENT_CONST" == "$VERSION" ]]; then
  fail "version mismatch: package.json=$CURRENT_PKG src/const.ts=$CURRENT_CONST"
else
  step "Bumping $CURRENT_PKG → $VERSION"
  npm version --no-git-tag-version "$VERSION" >/dev/null
  sed -i.bak "s/VERSION = '[^']*'/VERSION = '$VERSION'/" src/const.ts && rm src/const.ts.bak
  git --no-pager diff -- package.json src/const.ts
  if ! confirm "Commit version bump?"; then
    git checkout -- package.json src/const.ts
    fail "aborted by user"
  fi
  git add package.json src/const.ts
  git commit -m "Bump version to $VERSION"
fi

# ── Build ──────────────────────────────────────────────────────────────────
step "Building dist/"
npm run clean --silent
npm run build
[[ -f dist/advanced-entity-selector-card.js ]] \
  || fail "build did not produce dist/advanced-entity-selector-card.js"

# Sanity-check that the bundle contains the version string.
if ! grep -q "$VERSION" dist/advanced-entity-selector-card.js; then
  fail "bundle does not contain version $VERSION — build may be stale"
fi
ok "bundle built and contains version $VERSION"

# ── Tag ────────────────────────────────────────────────────────────────────
step "Tagging $TAG"
git tag -a "$TAG" -m "$TAG"

# ── Confirm before anything reaches the remote ─────────────────────────────
step "Ready to publish"
cat <<EOF
About to:
  • git push origin main
  • git push origin $TAG
  • gh release create $TAG  (asset: dist/advanced-entity-selector-card.js)
EOF
if ! confirm "Proceed?"; then
  git tag -d "$TAG" >/dev/null
  fail "aborted by user (local tag deleted)"
fi

# ── Push & release ─────────────────────────────────────────────────────────
step "Pushing main and $TAG"
git push origin main
git push origin "$TAG"

step "Creating GitHub release"
gh release create "$TAG" \
  dist/advanced-entity-selector-card.js \
  --title "$TAG" \
  --generate-notes

URL=$(gh release view "$TAG" --json url --jq .url)
ok "Released $TAG"
echo "$URL"
