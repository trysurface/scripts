#!/usr/bin/env bash
# Purges @latest for each file given and prints the files whose purge failed. A throttled purge still
# answers HTTP 200, so the body decides.
set -uo pipefail
failed=0
for f in "$@"; do
  url="https://purge.jsdelivr.net/gh/${GITHUB_REPOSITORY}@latest/${f}"
  body=$(curl -sfS --max-time 30 --retry 3 --retry-max-time 60 "${url}") || body=""
  if jq -e '[.paths[] | .throttled == false and ([.providers[]] | all)] | all' <<< "${body}" > /dev/null 2>&1; then
    echo "Purged ${url}" >&2
  else
    echo "::error::Purge failed or was throttled for ${url}: ${body:-no response}" >&2
    echo "${f}"
    failed=1
  fi
done
exit "${failed}"
