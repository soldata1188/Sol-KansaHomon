import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/reset-schedule — Wipe all schedule_cells and reports from Supabase
export async function POST() {
  try {
    const { error: e1 } = await supabase.from('reports').delete().neq('id', 0);
    if (e1) throw e1;

    const { error: e2 } = await supabase.from('schedule_cells').delete().neq('id', 0);
    if (e2) throw e2;

    console.log('[API/reset-schedule] All schedule_cells and reports deleted.');
    return NextResponse.json({ success: true, message: '全スケジュール・報告を削除しました。' });
  } catch (error) {
    console.error('[API/reset-schedule] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
