#!/bin/bash

# Enable Vercel Web Analytics and Speed Insights for Altus Connect
# This script enables monitoring features for the altus project

set -e

echo "� Checking Vercel CLI authentication..."

# Check if logged in
if ! vercel whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Vercel. Please login first:"
    echo "   Run: vercel login"
    echo "   Then visit the URL shown in your browser to authenticate"
    echo ""
    echo "After authentication, run this script again."
    exit 1
fi

echo "✅ Authenticated successfully"
echo ""

echo "�🚀 Enabling Vercel Monitoring for Altus Connect..."
echo ""

# Project details
PROJECT_NAME="altus"
TEAM_SLUG="saifs-projects-dede158c"

echo "📊 Enabling Web Analytics..."
vercel project web-analytics "$PROJECT_NAME" --scope "$TEAM_SLUG"

echo ""
echo "⚡ Enabling Speed Insights..."
vercel project speed-insights "$PROJECT_NAME" --scope "$TEAM_SLUG"

echo ""
echo "✅ Vercel monitoring features enabled!"
echo ""
echo "Next steps:"
echo "1. Deploy your changes to see analytics data"
echo "2. Visit Vercel Dashboard → Analytics tab"
echo "3. Visit Vercel Dashboard → Speed Insights tab"
echo ""
echo "Your React components in src/App.tsx will automatically"
echo "start sending data once deployed to production domains."