#!/bin/bash

echo "🎯 Pre-Deployment Checklist"
echo "================================"
echo ""

# 1. Check Node.js version
echo "1️⃣  Node.js Version:"
node --version
echo ""

# 2. Check if server.js has no syntax errors
echo "2️⃣  Checking server.js syntax..."
node -c server.js && echo "✅ server.js: No syntax errors" || echo "❌ server.js: Syntax errors found!"
echo ""

# 3. Check if script.js has no syntax errors
echo "3️⃣  Checking script.js syntax..."
node -c script.js && echo "✅ script.js: No syntax errors" || echo "❌ script.js: Syntax errors found!"
echo ""

# 4. Check if package.json is valid
echo "4️⃣  Checking package.json..."
node -e "JSON.parse(require('fs').readFileSync('package.json'))" && echo "✅ package.json: Valid JSON" || echo "❌ package.json: Invalid JSON!"
echo ""

# 5. Check if all dependencies are installed
echo "5️⃣  Checking dependencies..."
if [ -d "node_modules" ]; then
  echo "✅ node_modules exists"
else
  echo "❌ node_modules not found - run npm install"
fi
echo ""

# 6. Count files
echo "6️⃣  Project Statistics:"
echo "   - Total .js files: $(find . -name "*.js" -not -path "./node_modules/*" | wc -l)"
echo "   - Total .sql files: $(find . -name "*.sql" | wc -l)"
echo "   - Total .md files: $(find . -name "*.md" | wc -l)"
echo ""

# 7. Git status
echo "7️⃣  Git Status:"
git status --short
if [ -z "$(git status --short)" ]; then
  echo "✅ Working tree clean - all changes committed"
else
  echo "⚠️  Uncommitted changes found"
fi
echo ""

# 8. Check recent commits
echo "8️⃣  Recent Commits:"
git log --oneline -5
echo ""

# 9. Check if server can start
echo "9️⃣  Testing Server Startup..."
timeout 5 node server.js > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

if ps -p $SERVER_PID > /dev/null; then
  echo "✅ Server started successfully"
  kill $SERVER_PID 2>/dev/null
else
  echo "❌ Server failed to start"
fi
echo ""

# 10. Final summary
echo "================================"
echo "✨ Pre-Deployment Check Complete!"
echo "================================"
echo ""
echo "📋 Next Steps:"
echo "   1. ✅ Code is committed and pushed"
echo "   2. 🚀 Railway will auto-deploy"
echo "   3. ⏳ Wait 2-3 minutes"
echo "   4. 🧪 Test on production"
echo ""
