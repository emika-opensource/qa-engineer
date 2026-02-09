#!/bin/bash
cd /home/node/app
npm install --production 2>/dev/null || true
exec node server.js
