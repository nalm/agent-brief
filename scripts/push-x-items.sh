#!/usr/bin/env bash
# Wrapper: validate + merge + push X items to the x-data branch.
# usage: scripts/push-x-items.sh <new-items.json> [--dry-run]
exec node "$(dirname "$0")/push-x-items.mjs" "$@"
