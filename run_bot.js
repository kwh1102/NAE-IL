import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const weatherKey = process.env.VITE_WEATHER_API_KEY || process.env.WEATHER_API_KEY;
const openAiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Starting bot...");
  
  const { data: owners, error: ownersError } = await supabase
    .from('profiles')
    .select('id, store_region, store_industry')
    .eq('role', 'owner');
    
  if (ownersError || !owners) {
    console.error("Failed to load owners", ownersError);
    return;
  }

  for (const owner of owners) {
    console.log(`Processing owner: ${owner.id}`);
    const region = owner.store_region || '서울';
    const industry = owner.store_industry || '카페';
    
    let lat = 37.5665;
    let lon = 126.9780;

    if (weatherKey) {
      try {
        const cityQuery = region.split(' ')[0] || 'Seoul';
        const geoRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityQuery)}&limit=1&appid=${weatherKey}`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = geoData[0].lat;
            lon = geoData[0].lon;
          }
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      }
    }

    let forecastList = [];
    let tomorrowWeather = '맑음';
    if (weatherKey) {
      try {
        const wRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${weatherKey}&lang=kr&units=metric`);
        if (wRes.ok) {
          const wData = await wRes.json();
          const dailyData = wData.list.filter((_, i) => i % 8 === 0).slice(0, 5);
          forecastList = dailyData.map(d => d.weather[0]?.description || '맑음');
          if (forecastList.length > 1) {
            tomorrowWeather = forecastList[1];
          } else if (forecastList.length > 0) {
            tomorrowWeather = forecastList[0];
          }
        }
      } catch (e) {
        console.error("Forecast failed", e);
      }
    }

    const daysArr = ['일', '월', '화', '수', '목', '금', '토'];
    let targetDatesList = [];
    for(let i=0; i<7; i++) {
      const d = new Date();
      d.setHours(d.getHours() + 9);
      d.setDate(d.getDate() + i);
      targetDatesList.push({
        date: d.toISOString().split('T')[0],
        dow: daysArr[d.getDay()]
      });
    }

    let insights = [];
    let eventFactors = "특이사항 없음";
    let aiForecasts = [];

    if (openAiKey) {
      const datesText = targetDatesList.map(w => `${w.date}(${w.dow})`).join(', ');
      const weatherText = forecastList.length > 0 ? forecastList.join(', ') : '알 수 없음';

      const prompt = `
당신은 지역 기반 자영업자(사장님)를 위한 AI 비서입니다.
현재 매장 정보:
- 지역: ${region}
- 업종: ${industry}

향후 5일간 예상 날씨: ${weatherText}
향후 7일 날짜 목록 (오늘부터 시작): ${datesText}

위 날짜 목록에 해당하는 '앞으로 7일간'의 날씨를 OpenWeatherMap 데이터를 참고하여 예측하고, 요일별 특성(주말/평일), 업종 특성을 종합하여 향후 7일간의 일일 예상 방문객 수(명)를 추정해주세요.

또한 내일 날씨(${tomorrowWeather})에 맞춤화된 실용적인 마케팅 인사이트 2개와 내일 예상되는 특이사항 1줄을 작성해주세요. (이전 데이터입니다 사용 금지)

결과는 반드시 아래 JSON 형식으로 반환하세요:
{
  "event_factors": "내일은 비가 오므로 배달 매출 상승이 기대됩니다.",
  "forecasts": [
    { "target_date": "2026-05-29", "expected_visitors": 120, "weather_condition": "맑음" }
  ],
  "insights": [
    {
      "tag": "#날씨맞춤",
      "title": "내일 날씨 맞춤형 프로모션",
      "description": "내일 비가 오니 따뜻한 메뉴를 강조해보세요.",
      "image_url": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=600&auto=format&fit=crop",
      "color_theme": "from-blue-600 to-indigo-800"
    }
  ]
}
`;
      try {
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

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const cleanJson = aiData.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          
          insights = parsed.insights || [];
          eventFactors = parsed.event_factors || "특이사항 없음";
          aiForecasts = parsed.forecasts || [];
        } else {
          console.error("OpenAI error", await aiRes.text());
        }
      } catch (e) {
        console.error("OpenAI API 에러:", e);
      }
    }

    if (aiForecasts.length === 0) {
      aiForecasts = targetDatesList.map((w, idx) => ({
        target_date: w.date,
        expected_visitors: Math.floor(Math.random() * 50) + 100,
        weather_condition: forecastList[idx] || tomorrowWeather
      }));
    }

    // DB 저장 (기존 데이터 삭제)
    await supabase.from('forecasts').delete().eq('store_id', owner.id);
    await supabase.from('insights').delete().eq('store_id', owner.id);

    const insertForecasts = aiForecasts.map(f => ({
      store_id: owner.id,
      target_date: f.target_date,
      expected_visitors: f.expected_visitors,
      weather_condition: f.weather_condition,
      event_factors: eventFactors
    }));

    await supabase.from('forecasts').insert(insertForecasts);
    
    const insertInsights = insights.map(ins => ({
      store_id: owner.id,
      tag: ins.tag,
      title: ins.title,
      description: ins.description,
      image_url: ins.image_url,
      color_theme: ins.color_theme
    }));

    if (insertInsights.length > 0) {
      await supabase.from('insights').insert(insertInsights);
    }
    
    console.log(`Updated owner ${owner.id}`);
  }
}

run();
