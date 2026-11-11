#!/usr/bin/env bash
# Purges @latest and @main for each file given.
set -euo pipefail
for f in "$@"; do
  for ref in latest main; do
    url="https://purge.jsdelivr.net/gh/${GITHUB_REPOSITORY}@${ref}/${f}"
    echo "Purging ${url}"
    curl -sfS --retry 3 "${url}" > /dev/null || { echo "::error::Purge failed for ${url}"; exit 1; }
  done
done
