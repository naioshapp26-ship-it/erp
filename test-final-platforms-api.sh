#!/bin/bash

echo "🧪 اختبار شامل لـ API المنصات بعد الإصلاح"
echo "=================================================="
echo ""

BASE_URL="https://super-cmk2wuy9-production.up.railway.app/api"

echo "📋 اختبار 1: entity_id = INC03 (حاضنة السلامة)"
RESULT=$(curl -s "${BASE_URL}/incubators/INC03/platforms")
COUNT=$(echo "$RESULT" | jq 'length' 2>/dev/null)
if [ "$COUNT" -ge 1 ]; then
    echo "✅ نجح - تم تحميل $COUNT منصة"
    echo "$RESULT" | jq '.[0] | {name, code}'
else
    echo "❌ فشل"
    echo "$RESULT"
fi

echo ""
echo "📋 اختبار 2: numeric ID = 3 (نفس الحاضنة)"
RESULT=$(curl -s "${BASE_URL}/incubators/3/platforms")
COUNT=$(echo "$RESULT" | jq 'length' 2>/dev/null)
if [ "$COUNT" -ge 1 ]; then
    echo "✅ نجح - تم تحميل $COUNT منصة"
    echo "$RESULT" | jq '.[0] | {name, code}'
else
    echo "❌ فشل"
    echo "$RESULT"
fi

echo ""
echo "📋 اختبار 3: entity_id = INC04"
RESULT=$(curl -s "${BASE_URL}/incubators/INC04/platforms")
COUNT=$(echo "$RESULT" | jq 'length' 2>/dev/null)
if [ "$COUNT" -ge 1 ]; then
    echo "✅ نجح - تم تحميل $COUNT منصة"
    echo "$RESULT" | jq '.[0] | {name, code}'
else
    echo "❌ فشل"
    echo "$RESULT"
fi

echo ""
echo "📋 اختبار 4: entity_id غير موجود (INVALID)"
RESULT=$(curl -s "${BASE_URL}/incubators/INVALID/platforms")
if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "✅ نجح - رجع خطأ 404 كما هو متوقع"
else
    echo "❌ فشل - كان يجب أن يرجع خطأ"
fi

echo ""
echo "📋 اختبار 5: HQ001 (ليس حاضنة)"
RESULT=$(curl -s "${BASE_URL}/incubators/HQ001/platforms")
if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "✅ نجح - رجع خطأ 404 كما هو متوقع"
else
    echo "❌ فشل - كان يجب أن يرجع خطأ"
fi

echo ""
echo "✅ جميع الاختبارات اكتملت!"
