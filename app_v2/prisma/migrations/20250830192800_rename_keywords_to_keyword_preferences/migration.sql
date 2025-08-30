-- Rename keywords column to keyword_preferences and update data structure
-- Step 1: Add new column with proper default
ALTER TABLE "user_setting" ADD COLUMN "keyword_preferences" JSONB DEFAULT '{"enabled": false, "keywords": [], "threshold": 0.7}'::jsonb;

-- Step 2: Migrate existing data
UPDATE "user_setting" 
SET "keyword_preferences" = CASE 
  WHEN "keywords" = '[]'::jsonb THEN '{"enabled": false, "keywords": [], "threshold": 0.7}'::jsonb
  WHEN jsonb_typeof("keywords") = 'array' THEN jsonb_build_object(
    'enabled', false,
    'keywords', "keywords",
    'threshold', 0.7
  )
  ELSE '{"enabled": false, "keywords": [], "threshold": 0.7}'::jsonb
END;

-- Step 3: Drop old column
ALTER TABLE "user_setting" DROP COLUMN "keywords";