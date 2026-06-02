#!/bin/bash
set -e

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
fi
