import { createClient } from '@/lib/supabase/server';
import type { MatchTemplate } from '@/types';

export async function getClubTemplates(clubId: string): Promise<MatchTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('match_templates')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('day_of_week')
    .order('name');
  return (data || []) as MatchTemplate[];
}

export async function getTemplate(templateId: string): Promise<MatchTemplate | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('match_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();
  return data as MatchTemplate | null;
}
