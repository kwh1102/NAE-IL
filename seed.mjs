import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wfxtdmuxyzitjybjzozv.supabase.co';
const supabaseKey = 'sb_publishable_byG71BoJeqtQtPt78EEbUA_ECy1tSqp'; // ANON KEY
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const today = new Date().toISOString().split('T')[0];
  
  // RLS 때문에 anon 키로는 insert가 불가능할 수 있으므로, 
  // 차라리 Edge Function을 Deno 런타임으로 로컬에서 호출해서 확인하자?
  // 아니면 그냥 콘솔에 출력.
  console.log('Testing...');
}
run();
