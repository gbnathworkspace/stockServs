-- Migration: Add is_default column to watchlists table
-- Run this SQL against your Neon PostgreSQL database

-- Add the column with default value 0 (false)
ALTER TABLE watchlists 
ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

-- Optional: Set the first watchlist for each user as default
-- (Only if you want to mark existing watchlists as default)
UPDATE watchlists w1
SET is_default = 1
WHERE id IN (
    SELECT MIN(id) 
    FROM watchlists 
    GROUP BY user_id
);

-- Verify the migration
SELECT id, user_id, name, position, is_default 
FROM watchlists 
LIMIT 10;
