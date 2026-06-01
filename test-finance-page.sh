#!/bin/bash

echo "🧪 اختبار صفحة المالية الجديدة"
echo "================================"
echo ""

# Define colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="https://super-cmk2wuy9-production.up.railway.app"
ENTITY_ID=1

echo "📊 اختبار 1: تحميل الصفحة الرئيسية"
echo "-----------------------------------"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/finance/")
if [ "$STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ الصفحة متاحة (Status: $STATUS)${NC}"
else
    echo -e "${RED}❌ فشل تحميل الصفحة (Status: $STATUS)${NC}"
fi
echo ""

echo "📊 اختبار 2: API - نظرة عامة على التدفقات النقدية"
echo "------------------------------------------------"
OVERVIEW=$(curl -s "$BASE_URL/finance/cashflow/overview?entity_id=$ENTITY_ID")
TOTAL=$(echo "$OVERVIEW" | jq -r '.total_net_cashflow')
if [ "$TOTAL" != "null" ]; then
    echo -e "${GREEN}✅ البيانات متاحة${NC}"
    echo "   الرصيد الصافي: $TOTAL ر.س"
    echo "$OVERVIEW" | jq '{
        operating: .operating,
        investing: .investing,
        financing: .financing,
        total: .total_net_cashflow
    }'
else
    echo -e "${RED}❌ فشل جلب البيانات${NC}"
fi
echo ""

echo "📊 اختبار 3: API - التدفقات التشغيلية"
echo "------------------------------------"
OPERATING=$(curl -s "$BASE_URL/finance/cashflow/operating?entity_id=$ENTITY_ID")
OP_COUNT=$(echo "$OPERATING" | jq -r '.cashflows | length')
if [ "$OP_COUNT" != "null" ] && [ "$OP_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ البيانات متاحة${NC}"
    echo "   عدد المعاملات: $OP_COUNT"
else
    echo -e "${RED}❌ فشل جلب البيانات${NC}"
fi
echo ""

echo "📊 اختبار 4: API - التدفقات الاستثمارية"
echo "--------------------------------------"
INVESTING=$(curl -s "$BASE_URL/finance/cashflow/investing?entity_id=$ENTITY_ID")
INV_COUNT=$(echo "$INVESTING" | jq -r '.cashflows | length')
if [ "$INV_COUNT" != "null" ] && [ "$INV_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ البيانات متاحة${NC}"
    echo "   عدد المعاملات: $INV_COUNT"
else
    echo -e "${RED}❌ فشل جلب البيانات${NC}"
fi
echo ""

echo "📊 اختبار 5: API - التدفقات التمويلية"
echo "------------------------------------"
FINANCING=$(curl -s "$BASE_URL/finance/cashflow/financing?entity_id=$ENTITY_ID")
FIN_COUNT=$(echo "$FINANCING" | jq -r '.cashflows | length')
if [ "$FIN_COUNT" != "null" ] && [ "$FIN_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ البيانات متاحة${NC}"
    echo "   عدد المعاملات: $FIN_COUNT"
else
    echo -e "${RED}❌ فشل جلب البيانات${NC}"
fi
echo ""

echo "📊 اختبار 6: التحقق من محتوى الصفحة"
echo "----------------------------------"
PAGE_CONTENT=$(curl -s "$BASE_URL/finance/")

# Check for key elements
if echo "$PAGE_CONTENT" | grep -q "إيرادات هذا الشهر"; then
    echo -e "${GREEN}✅ عنوان 'إيرادات هذا الشهر' موجود${NC}"
else
    echo -e "${RED}❌ عنوان 'إيرادات هذا الشهر' مفقود${NC}"
fi

if echo "$PAGE_CONTENT" | grep -q "الفواتير (Invoices)"; then
    echo -e "${GREEN}✅ تبويب 'الفواتير' موجود${NC}"
else
    echo -e "${RED}❌ تبويب 'الفواتير' مفقود${NC}"
fi

if echo "$PAGE_CONTENT" | grep -q "سجل القيود (Ledger)"; then
    echo -e "${GREEN}✅ تبويب 'سجل القيود' موجود${NC}"
else
    echo -e "${RED}❌ تبويب 'سجل القيود' مفقود${NC}"
fi

if echo "$PAGE_CONTENT" | grep -q "المعاملات المالية"; then
    echo -e "${GREEN}✅ تبويب 'المعاملات المالية' موجود${NC}"
else
    echo -e "${RED}❌ تبويب 'المعاملات المالية' مفقود${NC}"
fi
echo ""

echo "📊 ملخص الاختبارات"
echo "================="
echo "   إجمالي المعاملات: $(($OP_COUNT + $INV_COUNT + $FIN_COUNT))"
echo "   الرصيد الصافي: $TOTAL ر.س"
echo ""
echo -e "${BLUE}🔗 رابط الصفحة: $BASE_URL/finance/${NC}"
echo ""
echo "✅ تم الانتهاء من جميع الاختبارات"
