#!/usr/bin/env bash
# Prints each file whose @latest copy is not version $1.
set -uo pipefail
version=$1
shift
for f in "$@"; do
  v=$(curl -sfSI --max-time 20 "https://cdn.jsdelivr.net/gh/${GITHUB_REPOSITORY}@latest/${f}" \
    | tr -d '\r' | awk -F': ' 'tolower($1) == "x-jsd-version" { print $2 }') || v=""
  echo "${f}: ${v:-unavailable}" >&2
  [ "${v}" = "${version}" ] || echo "${f}"
done
