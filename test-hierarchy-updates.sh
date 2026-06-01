#!/bin/bash
# اختبار شامل للتحديثات الجديدة

echo "🔍 بدء الاختبارات الشاملة للهيكل الهرمي..."
echo ""

# Test 1: Health check
echo "1️⃣ اختبار Health Check..."
HEALTH=$(curl -s http://localhost:3000/api/health)
if [[ $HEALTH == *"OK"* ]]; then
    echo "   ✅ السيرفر يعمل بشكل صحيح"
else
    echo "   ❌ خطأ في السيرفر"
    exit 1
fi
echo ""

# Test 2: Get hierarchy stats
echo "2️⃣ اختبار إحصائيات الهيكل الهرمي..."
STATS=$(curl -s http://localhost:3000/api/hierarchy/stats)
if [[ $STATS == *"active_hqs"* ]]; then
    echo "   ✅ تم جلب الإحصائيات بنجاح"
    echo "   📊 $STATS"
else
    echo "   ❌ فشل جلب الإحصائيات"
    exit 1
fi
echo ""

# Test 3: Get branch details
echo "3️⃣ اختبار تفاصيل الفرع..."
BRANCH=$(curl -s "http://localhost:3000/api/hierarchy/entity/BRANCH/1")
if [[ $BRANCH == *"\"type\":\"BRANCH\""* ]]; then
    echo "   ✅ تم جلب تفاصيل الفرع بنجاح"
    BRANCH_NAME=$(echo $BRANCH | python3 -c "import sys, json; print(json.load(sys.stdin)['entity']['name'])")
    INCUBATORS_COUNT=$(echo $BRANCH | python3 -c "import sys, json; print(len(json.load(sys.stdin)['incubators']))")
    echo "   📍 الفرع: $BRANCH_NAME"
    echo "   🌱 عدد الحاضنات: $INCUBATORS_COUNT"
else
    echo "   ❌ فشل جلب تفاصيل الفرع"
    exit 1
fi
echo ""

# Test 4: Get incubator details
echo "4️⃣ اختبار تفاصيل الحاضنة..."
INCUBATOR=$(curl -s "http://localhost:3000/api/hierarchy/entity/INCUBATOR/1")
if [[ $INCUBATOR == *"\"type\":\"INCUBATOR\""* ]]; then
    echo "   ✅ تم جلب تفاصيل الحاضنة بنجاح"
    INC_NAME=$(echo $INCUBATOR | python3 -c "import sys, json; print(json.load(sys.stdin)['entity']['name'])")
    PLATFORMS_COUNT=$(echo $INCUBATOR | python3 -c "import sys, json; print(len(json.load(sys.stdin)['platforms']))")
    OFFICES_COUNT=$(echo $INCUBATOR | python3 -c "import sys, json; print(len(json.load(sys.stdin)['offices']))")
    echo "   🏢 الحاضنة: $INC_NAME"
    echo "   💻 عدد المنصات: $PLATFORMS_COUNT"
    echo "   🏛️ عدد المكاتب: $OFFICES_COUNT"
else
    echo "   ❌ فشل جلب تفاصيل الحاضنة"
    exit 1
fi
echo ""

# Test 5: Get platform details
echo "5️⃣ اختبار تفاصيل المنصة..."
PLATFORM=$(curl -s "http://localhost:3000/api/hierarchy/entity/PLATFORM/1")
if [[ $PLATFORM == *"\"type\":\"PLATFORM\""* ]]; then
    echo "   ✅ تم جلب تفاصيل المنصة بنجاح"
    PLT_NAME=$(echo $PLATFORM | python3 -c "import sys, json; print(json.load(sys.stdin)['entity']['name'])")
    PLT_OFFICES=$(echo $PLATFORM | python3 -c "import sys, json; print(len(json.load(sys.stdin)['offices']))")
    echo "   🖥️ المنصة: $PLT_NAME"
    echo "   🏛️ عدد المكاتب المرتبطة: $PLT_OFFICES"
else
    echo "   ❌ فشل جلب تفاصيل المنصة"
    exit 1
fi
echo ""

# Test 6: Get office details
echo "6️⃣ اختبار تفاصيل المكتب..."
OFFICE=$(curl -s "http://localhost:3000/api/hierarchy/entity/OFFICE/2")
if [[ $OFFICE == *"\"type\":\"OFFICE\""* ]]; then
    echo "   ✅ تم جلب تفاصيل المكتب بنجاح"
    OFF_NAME=$(echo $OFFICE | python3 -c "import sys, json; print(json.load(sys.stdin)['entity']['name'])")
    OFF_PLATFORMS=$(echo $OFFICE | python3 -c "import sys, json; print(len(json.load(sys.stdin)['platforms']))")
    echo "   🏢 المكتب: $OFF_NAME"
    echo "   💻 عدد المنصات المرتبطة: $OFF_PLATFORMS"
else
    echo "   ❌ فشل جلب تفاصيل المكتب"
    exit 1
fi
echo ""

# Test 7: Check all APIs
echo "7️⃣ اختبار جميع الـ APIs الأساسية..."
APIS=(
    "entities"
    "headquarters"
    "branches"
    "incubators"
    "platforms"
    "offices"
)

for api in "${APIS[@]}"; do
    RESPONSE=$(curl -s "http://localhost:3000/api/$api")
    if [[ $RESPONSE == "["* ]]; then
        echo "   ✅ API /$api يعمل بشكل صحيح"
    else
        echo "   ❌ خطأ في API /$api"
        exit 1
    fi
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ جميع الاختبارات نجحت!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 ملخص التحديثات:"
echo "   • تم إضافة صفحة تفاصيل منفصلة لكل كيان"
echo "   • الهيكل الهرمي أصبح تفاعلي (clickable)"
echo "   • عرض الحاضنات داخل الفروع في الهيكل"
echo "   • عرض المنصات والمكاتب داخل كل حاضنة"
echo "   • إضافة بيانات تجريبية كاملة"
echo ""
echo "🎉 النظام جاهز للاستخدام!"
