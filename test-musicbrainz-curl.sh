#!/bin/bash

# MusicBrainz CD Integration Test Script
# Make sure your API server is running before executing this

API_BASE="http://localhost:3001"
JWT_TOKEN="your-jwt-token-here"  # Replace with your actual JWT token

echo "🚀 Testing MusicBrainz CD integration..."
echo ""

# Test 1: Health Check
echo "🔍 Testing health check..."
curl -s -w "Status: %{http_code}\n" "$API_BASE/health"
echo ""

# Test 2: CD Service Info
echo "🔍 Testing CD service info..."
curl -s -w "Status: %{http_code}\n" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/cd/info"
echo ""

# Test 3: CD Lookup - The Beatles Abbey Road
echo "🔍 Testing CD lookup (The Beatles - Abbey Road)..."
curl -s -w "Status: %{http_code}\n" \
  -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"barcode": "5099750442229"}' \
  "$API_BASE/api/cd/lookup"
echo ""

# Test 4: CD Search - The Beatles
echo "🔍 Testing CD search (The Beatles)..."
curl -s -w "Status: %{http_code}\n" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/cd/search?artist=The%20Beatles&title=Abbey%20Road"
echo ""

# Test 5: CD Search - Pink Floyd
echo "🔍 Testing CD search (Pink Floyd)..."
curl -s -w "Status: %{http_code}\n" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/cd/search?artist=Pink%20Floyd&title=Dark%20Side%20of%20the%20Moon"
echo ""

echo "🏁 Tests completed!"
echo ""
echo "Expected results:"
echo "✅ Health check: Status 200"
echo "✅ CD service info: Status 200 with MusicBrainz info"
echo "✅ CD lookups: Status 200 with CD metadata"
echo "✅ CD search: Status 200 with search results"
echo ""
echo "MusicBrainz benefits:"
echo "• Free and open source"
echo "• No API key required"
echo "• No rate limits"
echo "• Comprehensive music metadata"
echo "• Cover art integration"
echo ""
echo "If you see errors:"
echo "1. Make sure your API server is running: cd apps/mercania-api && npm run dev"
echo "2. Check your JWT token is valid"
echo "3. MusicBrainz is very reliable - if it fails, check your internet connection"
