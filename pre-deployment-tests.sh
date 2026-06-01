#!/bin/bash

echo "🚀 اختبارات ما قبل النشر - نظام نايوش"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for tests
PASSED=0
FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${YELLOW}🧪 $test_name${NC}"
    echo "----------------------------------------------------"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ نجح${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ فشل${NC}"
        ((FAILED++))
    fi
}

# Function to run test with output
run_test_with_output() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${YELLOW}🧪 $test_name${NC}"
    echo "----------------------------------------------------"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ نجح${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ فشل${NC}"
        ((FAILED++))
    fi
}

# Start tests
echo -e "\n${YELLOW}📋 قائمة الاختبارات:${NC}"
echo "1. اختبار قاعدة البيانات"
echo "2. اختبار APIs الخلفية"
echo "3. اختبار العلاقات بين الكيانات"
echo "4. اختبار نظام الموافقات"
echo "5. فحص بناء النظام"
echo "6. التحقق من الملفات المطلوبة"

# Test 1: Database
run_test_with_output "اختبار قاعدة البيانات" "node test-db.js"

# Test 2: API Endpoints
run_test_with_output "اختبار APIs الخلفية" "node test-api.js"

# Test 3: Entity Relationships
run_test_with_output "اختبار العلاقات بين الكيانات" "node test-entity-relationships.js"

# Test 4: Approvals System
run_test_with_output "اختبار نظام الموافقات" "node test-approvals.js"

# Test 5: Build Check
run_test "فحص بناء النظام" "npm test"

# Test 6: Required Files Check
echo -e "\n${YELLOW}🧪 التحقق من الملفات المطلوبة${NC}"
echo "----------------------------------------------------"

required_files=(
    "server.js"
    "package.json"
    "index.html"
    "script.js"
    "style.css"
    ".env"
)

files_missing=0
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file موجود"
    else
        echo "❌ $file مفقود"
        ((files_missing++))
    fi
done

if [[ $files_missing -eq 0 ]]; then
    echo -e "${GREEN}✅ جميع الملفات المطلوبة موجودة${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ $files_missing ملف مفقود${NC}"
    ((FAILED++))
fi

# Final Summary
echo -e "\n=================================================="
echo -e "${YELLOW}📊 تقرير الاختبارات النهائي${NC}"
echo "=================================================="
echo -e "${GREEN}✅ نجح: $PASSED اختبار${NC}"
echo -e "${RED}❌ فشل: $FAILED اختبار${NC}"

if [[ $FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 جميع الاختبارات نجحت! النظام جاهز للنشر${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  يوجد $FAILED اختبار فاشل. يرجى إصلاح المشاكل قبل النشر${NC}"
    exit 1
fi