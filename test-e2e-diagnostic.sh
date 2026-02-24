#!/bin/bash

# E2E Testing Diagnostic Script
# Check Vercel deployment and database connection

echo "=========================================="
echo "Fine & Country Zimbabwe - E2E Test Diagnostics"
echo "=========================================="
echo ""

# Test 1: Landing Page
echo "TEST 1: Landing Page Load"
echo "URL: https://developmentsfc.vercel.app/"
echo "Expected: Should load without white screen or MIME errors"
echo "Command: Open in browser and check page"
echo ""

# Test 2: API Endpoints
echo "TEST 2: API Endpoint Check"
echo "Testing /api/admin/developments..."
response=$(curl -s -w "\n%{http_code}" "https://developmentsfc.vercel.app/api/admin/developments")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

echo "HTTP Status: $http_code"
echo "Response Preview:"
echo "$body" | head -c 200
echo ""
echo ""

# Test 3: Database Connection
echo "TEST 3: Database Status"
if echo "$body" | grep -q "Database connection unavailable"; then
    echo "❌ Database is UNAVAILABLE on Vercel"
    echo "This means DATABASE_URL environment variable is not set"
    echo ""
    echo "ACTION REQUIRED:"
    echo "1. Go to Vercel Dashboard → Project Settings → Environment Variables"
    echo "2. Add DATABASE_URL with your Neon connection string"
    echo "3. Redeploy the application"
else
    echo "✅ Database connection appears to be working"
    echo "Response contains data"
fi
echo ""

# Test 4: Local Verification
echo "TEST 4: Verify Local Setup"
echo "Checking if Prisma is properly configured..."
if [ -f ".env.production" ]; then
    echo "✅ .env.production exists"
    echo "DATABASE_URL set: $(grep -c DATABASE_URL .env.production) times"
else
    echo "⚠️  .env.production not found"
fi

if [ -f "lib/prisma.ts" ]; then
    echo "✅ Prisma client file exists"
else
    echo "❌ Prisma client file missing"
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "1. Ensure DATABASE_URL is set in Vercel"
echo "2. Run 'npm run db:seed' locally to populate demo data"
echo "3. After seeding, data should appear in production"
echo "=========================================="
