#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$(dirname "$0")/mac" "$(dirname "$0")/windows"

curl -L "https://github.com/nagarjune/API-Captain/releases/download/v0.0.2/ApiTool-0.0.2-arm64.dmg" -o "$(dirname "$0")/mac/ApiTool-0.0.2-arm64.dmg"
curl -L "https://github.com/nagarjune/API-Captain/releases/download/v0.0.2/ApiTool-0.0.2-arm64.dmg.blockmap" -o "$(dirname "$0")/mac/ApiTool-0.0.2-arm64.dmg.blockmap"

curl -L "https://github.com/nagarjune/API-Captain/releases/download/v0.0.2/ApiTool.Setup.0.0.2.exe" -o "$(dirname "$0")/windows/ApiTool.Setup.0.0.2.exe"
curl -L "https://github.com/nagarjune/API-Captain/releases/download/v0.0.2/ApiTool.Setup.0.0.2.exe.blockmap" -o "$(dirname "$0")/windows/ApiTool.Setup.0.0.2.exe.blockmap"
