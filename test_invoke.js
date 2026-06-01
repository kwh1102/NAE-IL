const SUPABASE_URL = "https://wfxtdmuxyzitjybjzozv.supabase.co";
const ANON_KEY = "sb_publishable_byG71BoJeqtQtPt78EEbUA_ECy1tSqp"; // From .env

async function run() {
  console.log("Invoking edge function...");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-insight-bot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({ store_id: null })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

run();
