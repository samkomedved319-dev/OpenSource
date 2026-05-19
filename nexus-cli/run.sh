#!/usr/bin/env bash
# ============================================================================
# OpenSource CLI - Launch Script (Linux / macOS)
# Usage: ./run.sh [args...]
# Example: ./run.sh "Explain this codebase"
# Example: OBSIDIAN_VAULT=~/Notes ./run.sh "find auth patterns"
# ============================================================================
set -euo pipefail

VERSION="1.1.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  OpenSource CLI v${VERSION}"
echo "  Local-First AI Coding Agent"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "  [ERROR] Node.js not found. Install from https://nodejs.org"
    exit 1
fi

# Check Ollama (non-blocking)
if ! curl -s --max-time 2 http://localhost:11434/api/tags &>/dev/null; then
    echo "  [WARN]  Ollama not running. Start with: ollama serve"
    echo "          Then pull a model:   ollama pull llama3.2"
    echo ""
fi

# Show vault path if set
if [[ -n "${OBSIDIAN_VAULT:-}" ]]; then
    echo "  [VAULT] ${OBSIDIAN_VAULT}"
    echo ""
fi

# Install dependencies if missing
if [[ ! -d "${SCRIPT_DIR}/node_modules" ]]; then
    echo "  [SETUP] Installing dependencies..."
    npm install --silent
fi

# Build if dist is missing
if [[ ! -f "${SCRIPT_DIR}/dist/index.js" ]]; then
    echo "  [BUILD] Compiling TypeScript..."
    npm run build
fi

# Run
node "${SCRIPT_DIR}/dist/index.js" "$@"
