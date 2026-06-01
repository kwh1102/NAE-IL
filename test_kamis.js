const SUPABASE_URL = "https://wfxtdmuxyzitjybjzozv.supabase.co";
const ANON_KEY = "sb_publishable_byG71BoJeqtQtPt78EEbUA_ECy1tSqp";

async function run() {
  console.log("Invoking kamis-price-bot...");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/kamis-price-bot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({})
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

run();
