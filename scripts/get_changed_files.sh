#!/usr/bin/env bash
set -e

# garante que o base ref exista
git fetch origin "$GITHUB_BASE_REF" --depth=1

git diff --name-only "origin/$GITHUB_BASE_REF...HEAD" \
  | jq -R -s -c 'split("\n") | map(select(length > 0))'
