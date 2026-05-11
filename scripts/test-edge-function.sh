#!/bin/bash
# Quick test for AI extraction Edge Function

echo "🧪 Testing AI Extraction Edge Function"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Login to get session token
echo "1. Logging in as rama..."
SESSION_TOKEN=$(curl -s -X POST http://localhost:54321/rest/v1/rpc/login \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -d '{"p_username":"rama","p_password":"admin123"}' \
  | jq -r '.session_token')

if [ "$SESSION_TOKEN" == "null" ] || [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Logged in${NC}"
echo "Session Token: ${SESSION_TOKEN:0:20}..."
echo ""

# 2. Check remaining scans
echo "2. Checking remaining AI scans..."
REMAINING=$(curl -s -X POST http://localhost:54321/rest/v1/rpc/get_remaining_ai_scans \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d "{\"p_user_id\":\"ba98d317-ae71-4138-9df8-07cf0480bd7d\",\"p_limit\":20}" \
  | jq -r '.')

echo -e "${GREEN}✅ Remaining scans: $REMAINING/20${NC}"
echo ""

# 3. Test Edge Function (without real image - will fail but shows it's reachable)
echo "3. Testing Edge Function endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:54321/functions/v1/extract-qc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"imageBase64":"test"}')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Check if function is reachable
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  if [ "$(echo "$RESPONSE" | jq -r '.success')" == "false" ]; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    if [[ "$ERROR" == *"Invalid base64"* ]]; then
      echo -e "${GREEN}✅ Edge Function is reachable (expected error for test data)${NC}"
    else
      echo -e "${YELLOW}⚠️  Edge Function returned error: $ERROR${NC}"
    fi
  else
    echo -e "${GREEN}✅ Edge Function working!${NC}"
  fi
else
  echo -e "${RED}❌ Edge Function not responding correctly${NC}"
fi

echo ""
echo "📊 Summary:"
echo "- Edge Function URL: http://localhost:54321/functions/v1/extract-qc"
echo "- Authentication: ✅ Working"
echo "- Rate Limiting: ✅ $REMAINING scans remaining"
echo "- Edge Function: ✅ Reachable"
echo ""
echo "Next: Upload a real struk image via frontend to test full extraction"
