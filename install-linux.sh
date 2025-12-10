#!/bin/bash
# Script to remove Windows-compiled sqlite3 and reinstall for Linux

echo "🗑️  Removing node_modules and package-lock.json..."
rm -rf node_modules package-lock.json

echo "📦 Installing dependencies for Linux..."
npm install

echo "✅ Installation complete! You can now run: node server.js"

