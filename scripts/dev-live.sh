#!/bin/sh
# Starts the dev server with the live model. The API key is read from the macOS
# Keychain at start-up and only lives in this process's environment.
set -eu
ANTHROPIC_API_KEY="$(security find-generic-password -a javier -s skandia-anthropic -w)"
export ANTHROPIC_API_KEY
export VITE_LIVE_FRAMING=true
exec npx vite "$@"
