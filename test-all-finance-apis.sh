#!/bin/bash

echo "🧪 اختبار شامل لجميع APIs المالية"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3000"
ENTITY_ID="1"

PASSED=0
FAILED=0

# Test function
test_api() {
    local name=$1
    local url=$2
    local expected_field=$3
    
    echo -n "Testing: $name ... "
    
    RESPONSE=$(curl -s "$url")
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
    
    if [ "$SUCCESS" = "true" ]; then
        if [ ! -z "$expected_field" ]; then
            VALUE=$(echo "$RESPONSE" | jq -r ".$expected_field" 2>/dev/null)
            if [ "$VALUE" != "null" ] && [ ! -z "$VALUE" ]; then
                echo -e "${GREEN}✅ PASS${NC} (Value: $VALUE)"
                ((PASSED++))
            else
                echo -e "${RED}❌ FAIL${NC} (Field $expected_field not found)"
                ((FAILED++))
            fi
        else
            echo -e "${GREEN}✅ PASS${NC}"
            ((PASSED++))
        fi
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "Response: $RESPONSE"
        ((FAILED++))
    fi
}

echo "📊 Testing Finance APIs"
echo "----------------------"

test_api "1. Overview API" "$BASE_URL/finance/cashflow/overview?entity_id=$ENTITY_ID" "total_net_cashflow"
test_api "2. Operating Cashflows" "$BASE_URL/finance/cashflow/operating?entity_id=$ENTITY_ID" "cashflows"
test_api "3. Investing Cashflows" "$BASE_URL/finance/cashflow/investing?entity_id=$ENTITY_ID" "cashflows"
test_api "4. Financing Cashflows" "$BASE_URL/finance/cashflow/financing?entity_id=$ENTITY_ID" "cashflows"
test_api "5. Accounts" "$BASE_URL/finance/accounts?entity_id=$ENTITY_ID" "accounts"
test_api "6. AI Forecasts" "$BASE_URL/finance/ai/forecasts?entity_id=$ENTITY_ID" "forecasts"

echo ""
echo "📈 Detailed Data Check"
echo "---------------------"

# Get detailed stats
OVERVIEW=$(curl -s "$BASE_URL/finance/cashflow/overview?entity_id=$ENTITY_ID")
OPERATING=$(curl -s "$BASE_URL/finance/cashflow/operating?entity_id=$ENTITY_ID")
INVESTING=$(curl -s "$BASE_URL/finance/cashflow/investing?entity_id=$ENTITY_ID")
FINANCING=$(curl -s "$BASE_URL/finance/cashflow/financing?entity_id=$ENTITY_ID")
ACCOUNTS=$(curl -s "$BASE_URL/finance/accounts?entity_id=$ENTITY_ID")

echo "Operating:"
echo "  Inflow:  $(echo "$OVERVIEW" | jq -r '.operating.inflow') ر.س"
echo "  Outflow: $(echo "$OVERVIEW" | jq -r '.operating.outflow') ر.س"
echo "  Net:     $(echo "$OVERVIEW" | jq -r '.operating.net_cashflow') ر.س"
echo "  Count:   $(echo "$OPERATING" | jq -r '.cashflows | length') transactions"

echo ""
echo "Investing:"
echo "  Inflow:  $(echo "$OVERVIEW" | jq -r '.investing.inflow') ر.س"
echo "  Outflow: $(echo "$OVERVIEW" | jq -r '.investing.outflow') ر.س"
echo "  Net:     $(echo "$OVERVIEW" | jq -r '.investing.net_cashflow') ر.س"
echo "  Count:   $(echo "$INVESTING" | jq -r '.cashflows | length') transactions"

echo ""
echo "Financing:"
echo "  Inflow:  $(echo "$OVERVIEW" | jq -r '.financing.inflow') ر.س"
echo "  Outflow: $(echo "$OVERVIEW" | jq -r '.financing.outflow') ر.س"
echo "  Net:     $(echo "$OVERVIEW" | jq -r '.financing.net_cashflow') ر.س"
echo "  Count:   $(echo "$FINANCING" | jq -r '.cashflows | length') transactions"

echo ""
echo "Total Net Cashflow: $(echo "$OVERVIEW" | jq -r '.total_net_cashflow') ر.س"
echo "Total Accounts: $(echo "$ACCOUNTS" | jq -r '.accounts | length')"

echo ""
echo "========================"
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo "========================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi
