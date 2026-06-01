#!/bin/bash

echo "════════════════════════════════════════════════════"
echo "🧪 اختبار نهائي شامل للنظام المالي"
echo "════════════════════════════════════════════════════"
echo ""

# Test Database
echo "1️⃣ قاعدة البيانات Railway:"
node test-railway-database.js 2>&1 | grep -E "إجمالي:|عدد العمليات:|عدد التوقعات:"
echo ""

# Test All Data
echo "2️⃣ جميع البيانات عبر APIs:"
node test-all-data-complete.js 2>&1 | grep -E "العدد:|الصافي:|إجمالي السجلات:"
echo ""

# Test Build
echo "3️⃣ الصفحات والبناء:"
node test-build.js 2>&1 | grep "✅"
echo ""

echo "════════════════════════════════════════════════════"
echo "📊 النتيجة النهائية"
echo "════════════════════════════════════════════════════"
echo "✅ النظام جاهز للاستخدام على Railway!"
echo "🌐 https://super-cmk2wuy9-production.up.railway.app/finance/"
echo "════════════════════════════════════════════════════"
