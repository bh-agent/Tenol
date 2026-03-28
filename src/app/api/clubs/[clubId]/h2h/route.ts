import { getHeadToHead } from '@/lib/queries/h2h';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const player1 = url.searchParams.get('player1');
    const player2 = url.searchParams.get('player2');

    if (!player1 || !player2) {
      return NextResponse.json(
        { error: 'player1 and player2 are required' },
        { status: 400 }
      );
    }

    const result = await getHeadToHead(clubId, player1, player2);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
