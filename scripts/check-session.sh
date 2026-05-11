#!/bin/bash
# Check if rama has an active session

echo "🔍 Checking rama's session..."
echo ""

# Get rama's user ID
USER_ID="ba98d317-ae71-4138-9df8-07cf0480bd7d"

# Check sessions
echo "Active sessions for rama:"
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "
SELECT 
  token,
  created_at,
  expires_at,
  CASE 
    WHEN expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as status
FROM sessions 
WHERE user_id = '$USER_ID'::uuid
ORDER BY created_at DESC
LIMIT 5;
"

echo ""
echo "Session count:"
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -t -c "
SELECT COUNT(*) FROM sessions WHERE user_id = '$USER_ID'::uuid AND expires_at > NOW();
"
