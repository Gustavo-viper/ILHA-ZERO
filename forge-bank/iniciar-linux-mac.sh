#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Instale o Node.js em https://nodejs.org (versão LTS)"; exit 1; }
( sleep 1; (xdg-open http://localhost:8090 || open http://localhost:8090) >/dev/null 2>&1 ) &
node server.js
