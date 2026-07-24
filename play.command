#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js is not installed yet — it's the engine that runs the game."
  echo "  Opening the download page: click the big 'LTS' button, run the"
  echo "  installer, then open this file again."
  echo
  command -v open >/dev/null 2>&1 && open https://nodejs.org || xdg-open https://nodejs.org
  read -r -p "  Press enter to close this window..."
  exit 1
fi
node scripts/play.mjs
