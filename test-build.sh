#!/bin/bash

echo "🔨 اختبار عملية البناء..."
echo ""

# Test 1: Package installation
echo "1️⃣ اختبار تثبيت الحزم..."
time npm install --production > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ تثبيت الحزم نجح"
else
    echo "   ❌ فشل تثبيت الحزم"
    exit 1
fi

# Test 2: Check file count
echo ""
echo "2️⃣ فحص عدد الملفات..."
TOTAL_FILES=$(find . -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | wc -l)
echo "   📁 إجمالي الملفات: $TOTAL_FILES"

if [ -f .railwayignore ]; then
    echo "   ✅ ملف .railwayignore موجود"
else
    echo "   ⚠️  ملف .railwayignore غير موجود"
fi

# Test 3: Check required files
echo ""
echo "3️⃣ فحص الملفات الضرورية..."
REQUIRED_FILES=("server.js" "package.json" "db.js" "index.html" "script.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        SIZE=$(du -h "$file" | cut -f1)
        echo "   ✅ $file ($SIZE)"
    else
        echo "   ❌ $file غير موجود"
    fi
done

# Test 4: Test server startup (with timeout)
echo ""
echo "4️⃣ اختبار بدء تشغيل الخادم..."
timeout 10 node server.js &
SERVER_PID=$!
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "   ✅ الخادم يعمل (PID: $SERVER_PID)"
    kill $SERVER_PID
    wait $SERVER_PID 2>/dev/null
else
    echo "   ❌ الخادم لم يبدأ"
fi

echo ""
echo "═══════════════════════════════════════"
echo "✅ اختبار البناء اكتمل"
echo "═══════════════════════════════════════"
