-- Run in Supabase SQL Editor if you want optional profile fields used by older ScheduleSkies docs.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'Both';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pace TEXT DEFAULT 'Relaxed';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_updates BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS budget_php NUMERIC DEFAULT 5000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
