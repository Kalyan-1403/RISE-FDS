#!/bin/bash
# ===========================================
# RISE Feedback System - API Test Script
# ===========================================

BASE_URL="http://localhost:5000/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass_count=0
fail_count=0

test_endpoint() {
    local description="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local token="$5"
    local expected_status="$6"

    headers="-H 'Content-Type: application/json'"
    if [ -n "$token" ]; then
        headers="$headers -H 'Authorization: Bearer $token'"
    fi

    if [ "$method" = "GET" ]; then
        response=$(eval "curl -s -w '\n%{http_code}' -X GET '$url' $headers")
    else
        response=$(eval "curl -s -w '\n%{http_code}' -X $method '$url' $headers -d '$data'")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} [$status_code] $description"
        ((pass_count++))
    else
        echo -e "${RED}❌ FAIL${NC} [$status_code expected $expected_status] $description"
        echo "   Response: $body"
        ((fail_count++))
    fi

    echo "$body"
}

echo ""
echo "=========================================="
echo "  RISE API Test Suite"
echo "=========================================="
echo ""

# 1. Health Check
echo -e "${YELLOW}--- Health Check ---${NC}"
test_endpoint "Health check" "GET" "$BASE_URL/health" "" "" "200"
echo ""

# 2. Admin Login
echo -e "${YELLOW}--- Authentication ---${NC}"
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"ADMIN","password":"admin@123","role":"admin"}')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "" ]; then
    echo -e "${GREEN}✅ PASS${NC} Admin login successful"
    ((pass_count++))
else
    echo -e "${RED}❌ FAIL${NC} Admin login failed"
    echo "   Response: $ADMIN_RESPONSE"
    ((fail_count++))
fi

# 3. Wrong credentials
test_endpoint "Wrong password rejected" "POST" "$BASE_URL/auth/login" \
  '{"user_id":"ADMIN","password":"wrong","role":"admin"}' "" "401"
echo ""

# 4. Register HoD
echo -e "${YELLOW}--- Registration ---${NC}"
test_endpoint "Register new HoD" "POST" "$BASE_URL/auth/register" \
  '{"name":"Test HoD","college":"Prakasam","department":"ECE","mobile":"9876543211","email":"test@rise.edu","password":"Test@1234","user_id":"ECE-P_TEST"}' "" "201"

# 5. Duplicate HoD rejected
test_endpoint "Duplicate HoD rejected" "POST" "$BASE_URL/auth/register" \
  '{"name":"Another HoD","college":"Prakasam","department":"ECE","mobile":"9876543212","email":"test2@rise.edu","password":"Test@1234","user_id":"ECE-P_TEST2"}' "" "409"
echo ""

# 6. HoD Login
echo -e "${YELLOW}--- HoD Login ---${NC}"
HOD_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"ECE-P_TEST","password":"Test@1234","role":"hod","college":"Prakasam","department":"ECE"}')

HOD_TOKEN=$(echo $HOD_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -n "$HOD_TOKEN" ] && [ "$HOD_TOKEN" != "" ]; then
    echo -e "${GREEN}✅ PASS${NC} HoD login successful"
    ((pass_count++))
else
    echo -e "${RED}❌ FAIL${NC} HoD login failed"
    ((fail_count++))
fi
echo ""

# 7. Add Faculty
echo -e "${YELLOW}--- Faculty Management ---${NC}"
FAC_RESPONSE=$(curl -s -X POST "$BASE_URL/faculty" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HOD_TOKEN" \
  -d '{"code":"EC201","name":"Dr. Anand","subject":"Digital Electronics","year":"II","sem":"I","sec":"1","branch":"ECE","dept":"ECE","college":"Prakasam"}')

FAC_ID=$(echo $FAC_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('faculty',{}).get('id',''))" 2>/dev/null)

if [ -n "$FAC_ID" ] && [ "$FAC_ID" != "" ]; then
    echo -e "${GREEN}✅ PASS${NC} Faculty created (ID: $FAC_ID)"
    ((pass_count++))
else
    echo -e "${RED}❌ FAIL${NC} Faculty creation failed"
    echo "   Response: $FAC_RESPONSE"
    ((fail_count++))
fi

# Get Faculty
test_endpoint "Get faculty list" "GET" "$BASE_URL/faculty" "" "$HOD_TOKEN" "200"

# No auth
test_endpoint "No auth rejected" "GET" "$BASE_URL/faculty" "" "" "401"
echo ""

# 8. Create Batch
echo -e "${YELLOW}--- Batch Management ---${NC}"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/batch/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HOD_TOKEN" \
  -d "{\"college\":\"Prakasam\",\"dept\":\"ECE\",\"branch\":\"ECE\",\"year\":\"II\",\"sem\":\"I\",\"sec\":\"1\",\"slot\":1,\"slotStartDate\":\"2026-01-01\",\"slotEndDate\":\"2026-02-28\",\"faculty_ids\":[$FAC_ID]}")

BATCH_ID=$(echo $BATCH_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('batch',{}).get('id',''))" 2>/dev/null)

if [ -n "$BATCH_ID" ] && [ "$BATCH_ID" != "" ]; then
    echo -e "${GREEN}✅ PASS${NC} Batch created"
    ((pass_count++))
else
    echo -e "${RED}❌ FAIL${NC} Batch creation failed"
    echo "   Response: $BATCH_RESPONSE"
    ((fail_count++))
fi
echo ""

# 9. Submit Feedback
echo -e "${YELLOW}--- Feedback Submission ---${NC}"
FEEDBACK_DATA="{\"batchId\":\"$BATCH_ID\",\"comments\":\"Test feedback\",\"responses\":[{\"facultyId\":$FAC_ID,\"ratings\":{\"Knowledge of the subject\":9,\"Coming well prepared for the class\":8,\"Giving clear explanations\":9,\"Command of language\":7,\"Clear and audible voice\":8,\"Holding the attention of students through the class\":7,\"Providing more matter than in the textbooks\":6,\"Capability to clear the doubts of students\":8,\"Encouraging students to ask questions and participate\":9,\"Appreciating students as and when deserving\":8,\"Willingness to help students even out of the class\":7,\"Return of valued test papers/records in time\":6,\"Punctuality and following timetable schedule\":9,\"Coverage of syllabus\":8,\"Impartial (teaching all students alike)\":9}}]}"

test_endpoint "Submit feedback" "POST" "$BASE_URL/feedback/submit" "$FEEDBACK_DATA" "" "201"

# 10. Faculty Stats
test_endpoint "Get faculty stats" "GET" "$BASE_URL/feedback/faculty/$FAC_ID/stats" "" "" "200"
echo ""

# 11. Dashboard
echo -e "${YELLOW}--- Dashboards ---${NC}"
test_endpoint "Admin dashboard" "GET" "$BASE_URL/dashboard/admin" "" "$ADMIN_TOKEN" "200"
test_endpoint "HoD dashboard" "GET" "$BASE_URL/dashboard/hod" "" "$HOD_TOKEN" "200"
echo ""

# Summary
echo "=========================================="
echo -e "  Results: ${GREEN}$pass_count passed${NC}, ${RED}$fail_count failed${NC}"
echo "=========================================="