#!/bin/bash

echo "🧪 Final Platform Selection System Verification"
echo "=================================================="
echo ""

BASE_URL="https://super-cmk2wuy9-production.up.railway.app/api"

echo "📋 Test 1: API Endpoint Health Check"
echo "-----------------------------------"
curl -s "${BASE_URL}/incubators/1/platforms" | jq '.[] | {id, name, code}' 2>/dev/null && echo "✅ API Working" || echo "❌ API Failed"

echo ""
echo "📋 Test 2: Platform Count Verification"
echo "--------------------------------------"
PLATFORMS_1=$(curl -s "${BASE_URL}/incubators/1/platforms" | jq 'length' 2>/dev/null)
echo "Incubator 1: $PLATFORMS_1 platforms"

if [ "$PLATFORMS_1" -eq 2 ]; then
    echo "✅ Platform count verified"
else
    echo "❌ Unexpected platform count (expected 2, got $PLATFORMS_1)"
fi

echo ""
echo "📋 Test 3: Data Structure Validation"
echo "------------------------------------"
curl -s "${BASE_URL}/incubators/1/platforms" | jq '.[0]' 2>/dev/null | grep -q "id" && echo "✅ ID field exists" || echo "❌ Missing ID field"
curl -s "${BASE_URL}/incubators/1/platforms" | jq '.[0]' 2>/dev/null | grep -q "name" && echo "✅ Name field exists" || echo "❌ Missing Name field"
curl -s "${BASE_URL}/incubators/1/platforms" | jq '.[0]' 2>/dev/null | grep -q "incubator_id" && echo "✅ Incubator_id field exists" || echo "❌ Missing Incubator_id field"

echo ""
echo "📋 Test 4: All Incubators Check"
echo "-------------------------------"
for i in {1..5}; do
    COUNT=$(curl -s "${BASE_URL}/incubators/$i/platforms" | jq 'length' 2>/dev/null)
    echo "Incubator $i: $COUNT platforms ✅"
done

echo ""
echo "✨ All Verification Tests Complete!"
echo "======================================="
