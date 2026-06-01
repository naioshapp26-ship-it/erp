#!/bin/bash

echo "🧪 Testing Training Sessions Endpoint..."
echo ""

# Test data
TEST_DATA='{
  "entity_id": "INC03",
  "session_name": "Test Session API",
  "program_id": 1,
  "start_date": "2026-01-15",
  "end_date": "2026-02-15",
  "instructor_name": "Test Instructor",
  "location": "Test Location",
  "status": "PLANNED"
}'

echo "📤 Sending POST request to /api/training-sessions"
echo "Data: $TEST_DATA"
echo ""

# Make request
curl -X POST \
  https://super-cmk2wuy9-production.up.railway.app/api/training-sessions \
  -H "Content-Type: application/json" \
  -H "x-entity-type: INCUBATOR" \
  -H "x-entity-id: INC03" \
  -d "$TEST_DATA" \
  -v

echo ""
echo "✅ Test completed"
