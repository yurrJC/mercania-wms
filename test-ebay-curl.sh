#!/bin/bash

# eBay Auth'n'Auth Endpoint Test Script
# Make sure your API server is running before executing this

API_BASE="http://localhost:3001"
JWT_TOKEN="your-jwt-token-here"  # Replace with your actual JWT token

echo "🚀 Testing eBay Auth'n'Auth endpoints..."
echo ""

# Test 1: Health Check
echo "🔍 Testing health check..."
curl -s -w "Status: %{http_code}\n" "$API_BASE/health"
echo ""

# Test 2: Auth URL endpoint
echo "🔍 Testing Auth URL endpoint..."
curl -s -w "Status: %{http_code}\n" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/dvd/auth-url"
echo ""

# Test 3: DVD Lookup - The Matrix
echo "🔍 Testing DVD lookup (The Matrix)..."
curl -s -w "Status: %{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"upc": "883929247318"}' \
  "$API_BASE/api/dvd/lookup"
echo ""

# Test 4: DVD Lookup - Toy Story
echo "🔍 Testing DVD lookup (Toy Story)..."
curl -s -w "Status: %{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"upc": "786936224436"}' \
  "$API_BASE/api/dvd/lookup"
echo ""

# Test 5: DVD Lookup - Finding Nemo
echo "🔍 Testing DVD lookup (Finding Nemo)..."
curl -s -w "Status: %{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"upc": "786936279528"}' \
  "$API_BASE/api/dvd/lookup"
echo ""

echo "🏁 Tests completed!"
echo ""
echo "Expected results:"
echo "✅ Health check: Status 200"
echo "✅ Auth URL: Status 200 with authUrl in response"
echo "✅ DVD lookups: Status 200 with movie data"
echo ""
echo "If you see errors:"
echo "1. Make sure your API server is running: cd apps/mercania-api && npm run dev"
echo "2. Check your JWT token is valid"
echo "3. Verify EBAY_USER_TOKEN is set in your environment"
