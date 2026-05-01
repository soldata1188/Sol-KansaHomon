import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://splzmwgheywexmozbeax.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbHptd2doZXl3ZXhtb3piZWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUyNzY1MSwiZXhwIjoyMDkzMTAzNjUxfQ.aIwOkVnBkg6P-4asUvk6AOtEnxLSE2Y52VUDaCJCV5Q'
);

async function check() {
  const { data: cells, error } = await supabase.from('schedule_cells').select('*').neq('type', 'none').order('updated_at', { ascending: false }).limit(10);
  
  if (error) {
    console.error('Error fetching cells:', error);
  } else {
    console.log(`Supabase has ${cells.length} cells with type != 'none'.`);
    console.log(cells);
  }
}

check().catch(console.error);
