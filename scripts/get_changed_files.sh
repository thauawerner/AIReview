#!/bin/bash

set -e

git fetch origin "$GITHUB_BASE_REF"

FILES=$(git diff --name-only origin/"$GITHUB_BASE_REF"...HEAD \
  | grep -Ev "(node_modules|dist|bin|obj|coverage|.spec.ts)")

if [ -z "$FILES" ]; then
  echo "[]"
  exit 0
fi

echo "$FILES" | jq -R -s -c 'split("\n")[:-1]'
