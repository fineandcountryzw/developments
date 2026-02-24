#!/bin/bash

# Forensic Audit - API Testing Script
# Tests all admin endpoints with proper authentication

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-dev-admin-token}"

echo "🔍 Forensic Audit - API Testing"
echo "================================"
echo "Base URL: $BASE_URL"
echo "Auth Token: ${AUTH_TOKEN:0:20}..."
echo ""

# Function to make API call and check response
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing: $description... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        echo "  Response: $(echo $body | jq -r '.message // .error // "Success"' 2>/dev/null || echo $body | head -c 80)"
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
        echo "  Response: $(echo $body | jq '.' 2>/dev/null || echo $body)"
        return 1
    fi
    echo ""
}

# Test 1: User Invitation
echo "📧 Testing User Invitation API"
echo "-------------------------------"

test_endpoint "POST" "/api/admin/users/invite" \
    '{"email":"test@example.com","role":"AGENT","branch":"HARARE","fullName":"Test User"}' \
    201 \
    "Send user invitation"

test_endpoint "GET" "/api/admin/users/invite?branch=HARARE" \
    "" \
    200 \
    "Get pending invitations"

# Test 2: Settings/Logo Management
echo "🖼️  Testing Settings/Logo API"
echo "-----------------------------"

test_endpoint "GET" "/api/admin/settings?branch=HARARE" \
    "" \
    200 \
    "Get branch settings"

test_endpoint "POST" "/api/admin/settings" \
    '{"branch":"HARARE","logo_url":"https://example.com/logo.png","company_name":"Test Company"}' \
    200 \
    "Save branch logo"

# Test 3: Developments CRUD
echo "🏗️  Testing Developments API"
echo "----------------------------"

test_endpoint "GET" "/api/admin/developments" \
    "" \
    200 \
    "List developments"

test_endpoint "POST" "/api/admin/developments" \
    '{"name":"Test Development","location_name":"Test Location","branch":"HARARE","total_stands":10,"base_price":25000}' \
    201 \
    "Create development"

# Note: For PUT and DELETE, you'd need a real development ID
# These are commented out for now
# test_endpoint "PUT" "/api/admin/developments" \
#     '{"id":"dev_xxx","name":"Updated Name","base_price":30000}' \
#     200 \
#     "Update development"

# test_endpoint "DELETE" "/api/admin/developments" \
#     '{"id":"dev_xxx"}' \
#     200 \
#     "Delete development"

# Test 4: Diagnostics
echo "🔧 Testing Diagnostics API"
echo "--------------------------"

test_endpoint "GET" "/api/admin/diagnostics" \
    "" \
    200 \
    "System diagnostics"

# Test 5: User Management
echo "👥 Testing User Management API"
echo "-------------------------------"

test_endpoint "GET" "/api/admin/users?branch=HARARE" \
    "" \
    200 \
    "List users"

# Summary
echo "================================"
echo "✅ API Testing Complete"
echo ""
echo "📝 Next Steps:"
echo "  1. Review Vercel logs for [FORENSIC] entries"
echo "  2. Check database for created records"
echo "  3. Verify email delivery (if Resend configured)"
echo "  4. Test on live Vercel deployment URL"
echo ""
echo "🔍 To test on production:"
echo "  export AUTH_TOKEN='your-production-token'"
echo "  ./test-api.sh https://your-app.vercel.app"
echo ""
