ALTER TABLE public.match_participants ADD COLUMN guest_gender TEXT CHECK (guest_gender IN ('M', 'F'));

NOTIFY pgrst, 'reload schema';
