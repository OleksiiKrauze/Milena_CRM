-- Clear all old tags from cases table
-- This will set tags to empty array for all cases
-- Run this before manually setting new predefined tags

UPDATE cases SET tags = ARRAY[]::varchar[] WHERE tags IS NOT NULL OR tags != ARRAY[]::varchar[];

-- Verify the update
SELECT id, tags FROM cases WHERE tags IS NOT NULL AND tags != ARRAY[]::varchar[] LIMIT 5;

-- Show total count of cases
SELECT COUNT(*) as total_cases FROM cases;
