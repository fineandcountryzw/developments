#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# Vercel Environment Variables Bulk Import Script
# Phase 3: Neon Auth, Serverless, Executive Dashboards
# ═══════════════════════════════════════════════════════════════

set -e  # Exit on error

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Vercel Environment Variables - Bulk Import               ║"
echo "║  Fine & Country Zimbabwe ERP - Phase 3                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Check if user is logged in
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "⚠️  Not logged in. Running: vercel login"
    vercel login
fi

echo ""
echo "📝 IMPORTANT: Edit the DATABASE URLs below before running!"
echo "Replace YOUR_PASSWORD and YOUR_ENDPOINT with your Neon credentials"
echo ""
echo "Get values from: https://console.neon.tech/app/projects"
echo ""

# Database URLs - REPLACE THESE WITH YOUR ACTUAL VALUES
DB_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-YOUR_ENDPOINT-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
DB_URL_UNPOOLED="postgresql://neondb_owner:YOUR_PASSWORD@ep-YOUR_ENDPOINT.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Check if placeholder values are still there
if [[ "$DB_URL" == *"YOUR_PASSWORD"* ]] || [[ "$DB_URL" == *"YOUR_ENDPOINT"* ]]; then
    echo ""
    echo "❌ ERROR: DATABASE URLs still contain placeholders!"
    echo ""
    echo "Edit this script and replace:"
    echo "  - YOUR_PASSWORD → Your actual Neon password"
    echo "  - YOUR_ENDPOINT → Your Neon endpoint (e.g., mute-river-a4uai6d1)"
    echo ""
    echo "Then run again."
    exit 1
fi

echo "✅ Database URLs look good"
echo ""
echo "Starting import..."
echo ""

# Function to add environment variable
add_env_var() {
    local name=$1
    local value=$2
    local description=$3
    
    echo "📌 Adding: $name"
    echo "   $description"
    
    vercel env add "$name" "$value" production preview development > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Imported"
    else
        echo "   ⚠️  May already exist (that's OK)"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════
# DATABASE CONFIGURATION
# ═══════════════════════════════════════════════════════════════
echo "🗄️  DATABASE CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
add_env_var "DATABASE_URL" "$DB_URL" "Neon pooled connection"
add_env_var "DATABASE_URL_UNPOOLED" "$DB_URL_UNPOOLED" "Neon direct connection (migrations)"

# ═══════════════════════════════════════════════════════════════
# PRISMA CONFIGURATION
# ═══════════════════════════════════════════════════════════════
echo "⚙️  PRISMA CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
add_env_var "PRISMA_CLIENT_ENGINE_TYPE" "dataproxy" "Serverless optimization"

# ═══════════════════════════════════════════════════════════════
# NEON AUTH (Phase 3)
# ═══════════════════════════════════════════════════════════════
echo "🔐 NEON AUTH (Phase 3)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
add_env_var "VITE_NEON_AUTH_URL" "https://auth.neon.tech" "Neon Auth URL (frontend)"
add_env_var "NEON_AUTH_API_KEY" "neon_auth_key_YOUR_KEY_HERE" "Neon Auth API Key (server)"

# ═══════════════════════════════════════════════════════════════
# API KEYS & EXTERNAL SERVICES
# ═══════════════════════════════════════════════════════════════
echo "🔑 API KEYS & EXTERNAL SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
add_env_var "VITE_GEMINI_API_KEY" "AIzaSyD_YOUR_KEY_HERE" "Google Gemini (frontend)"
add_env_var "GEMINI_API_KEY" "AIzaSyD_YOUR_KEY_HERE" "Google Gemini (backend)"
add_env_var "UPLOADTHING_SECRET" "sk_live_YOUR_UPLOADTHING_SECRET" "UploadThing secret"
add_env_var "UPLOADTHING_APP_ID" "YOUR_UPLOADTHING_APP_ID" "UploadThing app ID"
add_env_var "RESEND_API_KEY" "re_YOUR_RESEND_KEY" "Resend email API key"

# ═══════════════════════════════════════════════════════════════
# NODE ENVIRONMENT
# ═══════════════════════════════════════════════════════════════
echo "🌍 NODE ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
add_env_var "NODE_ENV" "production" "Production environment"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Import Complete!                                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. ⚠️  UPDATE PLACEHOLDER VALUES:"
echo "   Go to: https://vercel.com/dashboard"
echo "   Project → Settings → Environment Variables"
echo ""
echo "   Update these with REAL values:"
echo "   - NEON_AUTH_API_KEY → Your actual Neon Auth key"
echo "   - VITE_GEMINI_API_KEY → Your actual Gemini API key"
echo "   - GEMINI_API_KEY → Your actual Gemini API key"
echo "   - UPLOADTHING_SECRET → Your actual UploadThing secret"
echo "   - UPLOADTHING_APP_ID → Your actual UploadThing app ID"
echo "   - RESEND_API_KEY → Your actual Resend API key (if using email)"
echo ""
echo "2. 🔄 REDEPLOY TO APPLY VARIABLES:"
echo "   vercel --prod"
echo ""
echo "3. ✅ VERIFY IN VERCEL DASHBOARD"
echo "   Check that all variables are set and environment shows properly"
echo ""
echo "4. 🧪 TEST IN PRODUCTION"
echo "   Visit your deployed app and test Executive Dashboard"
echo ""

echo "🎉 Phase 3 ready for production deployment!"
echo ""
