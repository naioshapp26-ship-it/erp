#!/bin/bash

echo "🧪 اختبار القائمة الجانبية والتوجيه"
echo "===================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Check if main page loads
echo "1️⃣ اختبار تحميل الصفحة الرئيسية..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://super-cmk2wuy9-production.up.railway.app/")
if [ "$STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ الصفحة الرئيسية تعمل (Status: $STATUS)${NC}"
else
    echo -e "${RED}❌ فشل تحميل الصفحة الرئيسية (Status: $STATUS)${NC}"
fi
echo ""

# Test 2: Check if script.js contains the new label
echo "2️⃣ اختبار القائمة الجانبية..."
CONTENT=$(curl -s "https://super-cmk2wuy9-production.up.railway.app/script.js")
if echo "$CONTENT" | grep -q "الفواتير والتقارير المالية"; then
    echo -e "${GREEN}✅ العنوان 'الفواتير والتقارير المالية' موجود في script.js${NC}"
else
    echo -e "${RED}❌ العنوان 'الفواتير والتقارير المالية' غير موجود${NC}"
fi
echo ""

# Test 3: Check if renderFinance redirects to /finance/
echo "3️⃣ اختبار دالة renderFinance..."
if echo "$CONTENT" | grep -q "window.location.href = '/finance/'"; then
    echo -e "${GREEN}✅ دالة renderFinance تحتوي على التوجيه إلى /finance/${NC}"
else
    echo -e "${RED}❌ دالة renderFinance لا تحتوي على التوجيه الصحيح${NC}"
fi
echo ""

# Test 4: Check if /finance/ page loads
echo "4️⃣ اختبار صفحة /finance/..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://super-cmk2wuy9-production.up.railway.app/finance/")
if [ "$STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ صفحة /finance/ متاحة (Status: $STATUS)${NC}"
else
    echo -e "${RED}❌ فشل تحميل صفحة /finance/ (Status: $STATUS)${NC}"
fi
echo ""

# Test 5: Check if finance page contains the correct title
echo "5️⃣ اختبار محتوى صفحة المالية..."
PAGE_CONTENT=$(curl -s "https://super-cmk2wuy9-production.up.railway.app/finance/")
if echo "$PAGE_CONTENT" | grep -q "إيرادات هذا الشهر"; then
    echo -e "${GREEN}✅ صفحة المالية تحتوي على المحتوى الصحيح${NC}"
else
    echo -e "${RED}❌ صفحة المالية لا تحتوي على المحتوى المتوقع${NC}"
fi
echo ""

# Test 6: Check if finance APIs work
echo "6️⃣ اختبار APIs المالية..."
API_RESPONSE=$(curl -s "https://super-cmk2wuy9-production.up.railway.app/finance/cashflow/overview?entity_id=1")
if echo "$API_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ APIs المالية تعمل بشكل صحيح${NC}"
    BALANCE=$(echo "$API_RESPONSE" | jq -r '.total_net_cashflow' 2>/dev/null)
    echo "   الرصيد الصافي: $BALANCE ر.س"
else
    echo -e "${RED}❌ APIs المالية لا تعمل${NC}"
fi
echo ""

echo "================================"
echo -e "${BLUE}✅ تم الانتهاء من جميع الاختبارات${NC}"
echo "================================"
