
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export default {
  fetch: async (req: Request) => {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const kamisApiKey = Deno.env.get('KAMIS_API_KEY') ?? '';
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const today = new Date().toISOString().split('T')[0];

      let pricesData = [];

      if (kamisApiKey) {
        try {
          // p_returntype=json 으로 JSON 응답 요청
          const res = await fetch(`http://www.kamis.or.kr/service/price/xml.do?action=dailyPriceByCategoryList&p_cert_key=${kamisApiKey}&p_cert_id=222&p_returntype=json`);
          
          if (res.ok) {
            const data = await res.json();
            
            // KAMIS JSON 응답 구조 파싱 (data.data.item 배열 구조 예상)
            let items = [];
            if (data && data.data && data.data.item) {
              items = Array.isArray(data.data.item) ? data.data.item : [data.data.item];
            } else if (data && data.item) {
              items = Array.isArray(data.item) ? data.item : [data.item];
            }
            
            if (items.length > 0) {
              // 앞에서 3개 아이템 정도만 추출
              const selectedItems = items.slice(0, 3);
              
              for (const item of selectedItems) {
                // "10,000" 문자열에서 콤마 제거 후 숫자로 파싱
                const parsePrice = (priceStr: string | number) => {
                  if (!priceStr || priceStr === '-') return 0;
                  if (typeof priceStr === 'number') return priceStr;
                  return Number(priceStr.replace(/,/g, ''));
                };

                const todayPrice = parsePrice(item.dpr1);
                const yesterdayPrice = parsePrice(item.dpr2);
                const itemName = `${item.item_name} ${item.kind_name || ''}`;
                
                let changeRate = 0;
                let trend = '-';
                
                if (yesterdayPrice > 0) {
                  changeRate = ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100;
                  trend = changeRate > 0 ? '상승' : changeRate < 0 ? '하락' : '동일';
                }

                // 의미 있는 데이터(오늘 가격 존재)인 경우만 추가
                if (todayPrice > 0) {
                  pricesData.push({
                    target_date: today,
                    item_name: itemName.trim(),
                    price_change_rate: Number(changeRate.toFixed(1)),
                    trend: trend
                  });
                }
              }
            } else {
              console.warn("KAMIS 응답에 유효한 데이터가 없습니다.");
            }
          } else {
            console.warn("KAMIS API 오류 상태코드:", res.status);
          }
        } catch (e) {
          console.error("KAMIS API 연동 실패:", e);
        }
      } 
      
      if (pricesData.length === 0) {
        // API 키가 없거나 통신 장애시 폴백 데이터
        pricesData = [
          { target_date: today, item_name: '대파(1kg) (대체)', price_change_rate: 1.5, trend: '상승' },
          { target_date: today, item_name: '토마토(1kg) (대체)', price_change_rate: -2.3, trend: '하락' }
        ];
      }

      // Supabase DB에 저장 (이미 오늘 날짜 데이터가 있으면 무시하거나 업데이트)
      for (const item of pricesData) {
        const { error } = await supabase
          .from('market_prices')
          .upsert(item, { onConflict: 'target_date,item_name' });

        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "성공적으로 농산물 시세 데이터를 수집했습니다.",
          data: pricesData
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" } 
        }
      );

    } catch (error: any) {
      console.error(error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" } 
        }
      );
    }
  }
};
