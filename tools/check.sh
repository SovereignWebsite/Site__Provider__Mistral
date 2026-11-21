#!/bin/sh
# Local checks, as in .github/workflows/pages.yml. The demos are built elsewhere and placed at site/demos/ by the
# conductor; until then, a copy of ../demos (if present) is put into _site/demos/ so internal links can be checked.
set -e
cd "$(dirname "$0")/.."
node tools/gen.mjs
node tools/nav.mjs --check
for t in docs/review/studio-*/tools/test-*.mjs; do node "$t"; done
node .github/ci/build.mjs
node .github/ci/share-check.mjs _site
if [ ! -d site/demos ] && [ -d ../demos ]; then
  mkdir -p _site/demos
  for f in ../demos/*.html ../demos/*.js ../demos/*.css; do [ -f "$f" ] && cp "$f" _site/demos/; done
  echo "copied ../demos into _site/demos for the checks only"
fi
node .github/ci/quality.mjs _site
