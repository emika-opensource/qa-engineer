#!/bin/bash
cd /home/node/app

# Install all deps (including devDependencies like @playwright/test)
npm install --include=dev 2>/dev/null || true

# Install Playwright browsers if not present
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    npx playwright install chromium 2>/dev/null || true
fi

exec node server.js
