import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/delete-enterprise — Delete one enterprise + all its schedules/reports (CASCADE)
export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    // CASCADE on schedule_cells and reports is handled by FK ON DELETE CASCADE in schema
    const { error } = await supabase.from('enterprises').delete().eq('id', id);
    if (error) throw error;

    console.log(`[API/delete-enterprise] Deleted enterprise: ${id}`);
    return NextResponse.json({ success: true, message: `${id} を削除しました。` });
  } catch (error) {
    console.error('[API/delete-enterprise] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
