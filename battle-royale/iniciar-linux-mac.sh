#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Instale o Node.js em https://nodejs.org (versão LTS)"; exit 1; }
[ -d node_modules/ws ] || npm install
( sleep 1; (xdg-open http://localhost:8080 || open http://localhost:8080) >/dev/null 2>&1 ) &
node server.js
