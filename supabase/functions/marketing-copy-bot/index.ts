import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  fetch: async (req: Request) => {
    // CORS preflight 처리
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const openAiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAiKey) {
        throw new Error("OpenAI API 키가 설정되지 않았습니다.");
      }

      const body = await req.json();
      const { target, budget } = body;

      const prompt = `당신은 카페 마케팅 전문가입니다. 
타겟 고객: '${target}', 일일 예산: ${budget}원.
이 타겟 고객이 카페에 방문하도록 유도하는 매력적인 문자(SMS) 광고 문구 3가지를 작성해주세요.
반드시 JSON 배열 형식으로만 응답해야 합니다.
형식: ["문구 1", "문구 2", "문구 3"]`;

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      if (!aiRes.ok) {
        throw new Error(`OpenAI API 오류: ${await aiRes.text()}`);
      }

      const aiData = await aiRes.json();
      const aiContent = aiData.choices[0].message.content;
      
      const cleanJson = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const copies = JSON.parse(cleanJson);

      return new Response(
        JSON.stringify({ success: true, copies }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );

    } catch (error: any) {
      console.error(error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
  }
};
