#!/bin/bash

# Google Sheets KPI Manager - Setup Script
# This script sets up the development environment

echo "🚀 Google Sheets KPI Manager - Setup"
echo "===================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    echo "   Download from: https://nodejs.org"
    exit 1
fi

echo "✓ Node.js $(node --version)"
echo "✓ npm $(npm --version)"
echo ""

# Check service account file
if [ ! -f "n8nworkflows-471200-2d198eaf6e2a.json" ]; then
    echo "⚠️  Service account file not found!"
    echo "   Expected: n8nworkflows-471200-2d198eaf6e2a.json"
    echo ""
    echo "   The service account file should be in the project root."
    echo "   This file is required to authenticate with Google Sheets."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Service account file found"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build TypeScript"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Start development server:"
echo "   npm run dev"
echo ""
echo "2. Open browser:"
echo "   http://localhost:3000"
echo ""
echo "3. Load your Google Sheet and start managing data!"
echo ""
echo "For more info, see:"
echo "   - README.md (API docs & features)"
echo "   - DEVELOPMENT.md (development guide)"
echo ""
