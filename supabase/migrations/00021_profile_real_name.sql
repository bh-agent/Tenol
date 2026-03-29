-- Add real_name column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS real_name TEXT;
