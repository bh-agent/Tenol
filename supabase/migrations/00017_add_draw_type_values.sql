-- Add new draw_type enum values for v1 and v2 engines
ALTER TYPE public.draw_type ADD VALUE IF NOT EXISTS 'mixed_doubles';
ALTER TYPE public.draw_type ADD VALUE IF NOT EXISTS 'mens_doubles';
ALTER TYPE public.draw_type ADD VALUE IF NOT EXISTS 'womens_doubles';
ALTER TYPE public.draw_type ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE public.draw_type ADD VALUE IF NOT EXISTS 'mixed_all';
ALTER TYPE public.draw_type ADD VALUE IF NOT EXISTS 'mixed_only';
ALTER TYPE public.draw_type ADD VALUE IF NOT EXISTS 'gendered_only';
