import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://splzmwgheywexmozbeax.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbHptd2doZXl3ZXhtb3piZWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUyNzY1MSwiZXhwIjoyMDkzMTAzNjUxfQ.aIwOkVnBkg6P-4asUvk6AOtEnxLSE2Y52VUDaCJCV5Q'
);

async function testFullSync() {
  console.log('📤 Testing full data sync to Supabase...\n');

  // 1. Upsert enterprise
  const { error: e1 } = await supabase.from('enterprises').upsert({
    id: 'SYNC_TEST_001',
    name: 'テスト株式会社',
    count_tokutei: 2,
    count_jisshu23: 3,
    count_jisshu1: 1,
    entry_date_jisshu1: '2026-04-01',
    resp_name: '山田太郎',
    resp_date: '2024-03-01',
    instr_name: '佐藤花子',
    instr_date: '2024-03-01',
    life_name: '鈴木次郎',
    life_date: '2024-03-01',
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });
  if (e1) { console.error('❌ Enterprise upsert failed:', e1.message); return; }
  console.log('✅ Enterprise saved');

  // 2. Upsert schedule cells
  const { error: e2 } = await supabase.from('schedule_cells').upsert([
    { enterprise_id: 'SYNC_TEST_001', fiscal_year: 2026, month: 4, type: 'audit', status: 'completed' },
    { enterprise_id: 'SYNC_TEST_001', fiscal_year: 2026, month: 7, type: 'audit', status: 'pending' },
    { enterprise_id: 'SYNC_TEST_001', fiscal_year: 2026, month: 5, type: 'visit', status: 'pending' },
  ], { onConflict: 'enterprise_id,fiscal_year,month' });
  if (e2) { console.error('❌ Schedule cells failed:', e2.message); return; }
  console.log('✅ Schedule cells saved (3 cells)');

  // 3. Upsert report
  const { error: e3 } = await supabase.from('reports').upsert({
    enterprise_id: 'SYNC_TEST_001',
    fiscal_year: 2026,
    month: 4,
    type: 'audit',
    staff: '担当者A',
    report_date: '2026-04-15',
    interviewee: '社長',
    check_salary: 'ok',
    check_log: 'ok',
    remarks: '異常なし'
  }, { onConflict: 'enterprise_id,fiscal_year,month' });
  if (e3) { console.error('❌ Report upsert failed:', e3.message); return; }
  console.log('✅ Report saved');

  // 4. Read back
  const { data: readBack, error: e4 } = await supabase
    .from('enterprises').select('id, name').eq('id', 'SYNC_TEST_001');
  if (e4) { console.error('❌ Read back failed:', e4.message); return; }
  console.log('✅ Read back:', JSON.stringify(readBack));

  // 5. Count all records
  const { count: entCount } = await supabase.from('enterprises').select('*', { count: 'exact', head: true });
  const { count: cellCount } = await supabase.from('schedule_cells').select('*', { count: 'exact', head: true });
  const { count: repCount } = await supabase.from('reports').select('*', { count: 'exact', head: true });
  console.log(`\n📊 Supabase now has: ${entCount} enterprises | ${cellCount} schedule cells | ${repCount} reports`);

  // 6. Cleanup test data
  await supabase.from('enterprises').delete().eq('id', 'SYNC_TEST_001');
  console.log('🧹 Test data cleaned up');
  console.log('\n🎉 Full sync test PASSED! Supabase is ready for production!');
}

testFullSync().catch(console.error);
