import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://yiertxnvtsbqenwasrsu.supabase.co', 'sb_publishable_GtP0dalUnbQnaUIxwUEIoA_-5UZm1Zf');

async function test() {
  console.log("Reading...");
  const res1 = await supabase.from('tree_data').select('data').eq('id', 1).single();
  console.log("Read result:", JSON.stringify(res1));

  console.log("Writing...");
  const res2 = await supabase.from('tree_data').upsert({ id: 1, data: { test: 123 } });
  console.log("Write result:", JSON.stringify(res2));
}

test();
