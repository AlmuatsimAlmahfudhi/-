#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js first: https://nodejs.org"; read; exit 1; }
[ -d node_modules ] || { echo "Installing for the first time..."; npm install; }
[ -f .env.local ] || cp .env.example .env.local
[ -f .next/BUILD_ID ] || { echo "Building..."; npm run build; }
(sleep 4; open http://localhost:3000) &
npm run start
