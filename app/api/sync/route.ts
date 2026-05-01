import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Enterprise, ScheduleCell, Report } from '@/lib/types';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
//  Logic helpers
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
//  GET — Load all data from Supabase
// ─────────────────────────────────────────────
export async function GET() {
  try {
    // 1. Fetch enterprises
    const { data: ents, error: entsErr } = await supabase
      .from('enterprises')
      .select('*')
      .order('entry_date_jisshu1', { ascending: false, nullsFirst: false });

    if (entsErr) throw entsErr;

    // 2. Fetch all schedule cells
    const { data: cells, error: cellsErr } = await supabase
      .from('schedule_cells')
      .select('*');

    if (cellsErr) throw cellsErr;

    // 3. Fetch all reports
    const { data: reps, error: repsErr } = await supabase
      .from('reports')
      .select('*');

    if (repsErr) throw repsErr;

    // 4. Build cache object: { [year]: { [entId]: ScheduleCell[] } }
    const cache: Record<number, Record<string, ScheduleCell[]>> = {};

    // Index reports by key for fast lookup
    const reportsMap = new Map<string, Report>();
    (reps || []).forEach(r => {
      const key = `${r.enterprise_id}:${r.fiscal_year}:${r.month}`;
      reportsMap.set(key, {
        staff:        r.staff || '',
        date:         r.report_date || '',
        interviewee:  r.interviewee || '',
        checkSalary:  r.check_salary || 'none',
        checkLog:     r.check_log || 'none',
        remarks:      r.remarks || '',
        vStaff:       r.v_staff || '',
        vDate:        r.v_date || '',
        vInterviewee: r.v_interviewee || '',
      });
    });

    (cells || []).forEach(c => {
      if (!cache[c.fiscal_year]) cache[c.fiscal_year] = {};
      if (!cache[c.fiscal_year][c.enterprise_id]) cache[c.fiscal_year][c.enterprise_id] = [];
      const key = `${c.enterprise_id}:${c.fiscal_year}:${c.month}`;
      cache[c.fiscal_year][c.enterprise_id].push({
        month:  c.month,
        type:   c.type,
        status: c.status,
        report: reportsMap.get(key),
      });
    });

    // Sort each cell array by month order [4..12, 1..3]
    const MONTH_ORDER = [4,5,6,7,8,9,10,11,12,1,2,3];
    Object.values(cache).forEach(yearObj => {
      Object.keys(yearObj).forEach(entId => {
        yearObj[entId].sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
      });
    });

    // 5. Map enterprises to frontend shape
    const enterprises: Enterprise[] = (ents || []).map(e => ({
      id:                 e.id,
      name:               e.name,
      countTokutei:       e.count_tokutei || 0,
      countJisshu23:      e.count_jisshu23 || 0,
      countJisshu1:       e.count_jisshu1 || 0,
      entryDateJisshu1:   e.entry_date_jisshu1 || '',
      respName:           e.resp_name || '',
      respDate:           e.resp_date || '',
      instrName:          e.instr_name || '',
      instrDate:          e.instr_date || '',
      lifeName:           e.life_name || '',
      lifeDate:           e.life_date || '',
      schedule:           [], // filled in by page.tsx loadScheduleWithReports
    }));

    return NextResponse.json({ enterprises, cache }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[API/sync GET] Error:', error);
    return NextResponse.json(
      { enterprises: [], cache: {}, error: String(error) },
      { status: 200 }
    );
  }
}

// ─────────────────────────────────────────────
//  POST — Save all data to Supabase
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: {
      enterprises: Enterprise[];
      cache: Record<number, Record<string, ScheduleCell[]>>;
    } = await request.json();

    const { enterprises, cache } = body;
    console.log('[API/sync POST] enterprises:', enterprises.length);

    // ── 1. Upsert enterprises ──────────────────────────────
    const entRows = enterprises.map(e => ({
      id:                   e.id,
      name:                 e.name,
      count_tokutei:        e.countTokutei || 0,
      count_jisshu23:       e.countJisshu23 || 0,
      count_jisshu1:        e.countJisshu1 || 0,
      entry_date_jisshu1:   e.entryDateJisshu1 || null,
      resp_name:            e.respName || null,
      resp_date:            e.respDate || null,
      instr_name:           e.instrName || null,
      instr_date:           e.instrDate || null,
      life_name:            e.lifeName || null,
      life_date:            e.lifeDate || null,
      updated_at:           new Date().toISOString(),
    }));

    const { error: entErr } = await supabase
      .from('enterprises')
      .upsert(entRows, { onConflict: 'id' });

    if (entErr) throw entErr;

    // ── 2. Upsert schedule_cells from cache ────────────────
    const cellRows: {
      enterprise_id: string;
      fiscal_year: number;
      month: number;
      type: string;
      status: string;
    }[] = [];

    Object.entries(cache).forEach(([yearStr, yearObj]) => {
      const fiscal_year = Number(yearStr);
      Object.entries(yearObj).forEach(([entId, cells]) => {
        cells.forEach(cell => {
          cellRows.push({
            enterprise_id: entId,
            fiscal_year,
            month:  cell.month,
            type:   cell.type,
            status: cell.status,
          });
        });
      });
    });

    if (cellRows.length > 0) {
      // Process in chunks to avoid hitting request size limits
      const CHUNK = 500;
      for (let i = 0; i < cellRows.length; i += CHUNK) {
        const chunk = cellRows.slice(i, i + CHUNK);
        const { error: cellErr } = await supabase
          .from('schedule_cells')
          .upsert(chunk, { onConflict: 'enterprise_id,fiscal_year,month' });
        if (cellErr) throw cellErr;
      }
    }

    // ── 3. Upsert reports (only completed cells with report data) ──
    const reportRows: Record<string, unknown>[] = [];

    Object.entries(cache).forEach(([yearStr, yearObj]) => {
      const fiscal_year = Number(yearStr);
      Object.entries(yearObj).forEach(([entId, cells]) => {
        cells.forEach(cell => {
          if (cell.status === 'completed' && cell.report) {
            const r = cell.report;
            reportRows.push({
              enterprise_id: entId,
              fiscal_year,
              month:         cell.month,
              type:          cell.type,
              staff:         r.staff || null,
              report_date:   r.date || null,
              interviewee:   r.interviewee || null,
              check_salary:  r.checkSalary || null,
              check_log:     r.checkLog || null,
              v_staff:       r.vStaff || null,
              v_date:        r.vDate || null,
              v_interviewee: r.vInterviewee || null,
              remarks:       r.remarks || null,
            });
          }
        });
      });
    });

    if (reportRows.length > 0) {
      const { error: repErr } = await supabase
        .from('reports')
        .upsert(reportRows, { onConflict: 'enterprise_id,fiscal_year,month' });
      if (repErr) throw repErr;
    }

    console.log(`[API/sync POST] Done — ${entRows.length} enterprises, ${cellRows.length} cells, ${reportRows.length} reports`);

    return NextResponse.json({
      success: true,
      message: `同期完了: ${entRows.length}社 / ${cellRows.length}件のスケジュール / ${reportRows.length}件のレポート`
    });
  } catch (error) {
    console.error('[API/sync POST] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
