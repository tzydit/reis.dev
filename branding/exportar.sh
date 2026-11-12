#!/usr/bin/env bash
# Exporta todas as peças do kit para branding/export, em tamanho real.
# Precisa de um servidor local servindo a raiz do projeto, por exemplo:
#   npx -y http-server -p 5500 -c-1
# Uso: bash branding/exportar.sh [url-base]
set -euo pipefail
BASE="${1:-http://127.0.0.1:5500}"
DIR="$(cd "$(dirname "$0")" && pwd)/export"
mkdir -p "$DIR"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
[ -f "$CHROME" ] || CHROME="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

shot() { # id largura altura arquivo [extra-query]
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$3" --virtual-time-budget=6000 \
    --screenshot="$(cygpath -w "$DIR/$4.png" 2>/dev/null || echo "$DIR/$4.png")" \
    "$BASE/branding/kit.html?export=1&p=$1${5:-}" >/dev/null 2>&1
  echo "ok  $4.png"
}

shot post-portfolio 1080 1350 post-01-portfolio-financasiq "&proj=financasiq"
shot post-portfolio 1080 1350 post-01-portfolio-drandre "&proj=drandre"
shot post-processo 1080 1350 post-02-processo
shot post-dica 1080 1350 post-03-dica
shot story 1080 1920 story-chamada
shot avatar 1080 1080 avatar
shot icone 184 184 icon-184
for k in portfolio processo orcamento bastidores contato; do
  shot "destaque-$k" 1080 1920 "destaque-$k"
done
