import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, ArrowLeft, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

export default function Pricing() {
  const navigate = useNavigate();
  const [cost, setCost] = useState<number>(3500);
  const [marginRate, setMarginRate] = useState<number>(60);
  const [sellingPrice, setSellingPrice] = useState<number>(0);

  const [marketPrices, setMarketPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 원가율 = (원가 / 판매가) * 100
    // 마진율 = 100 - 원가율
    // 판매가 = 원가 / (1 - (마진율 / 100))
    const calculatedPrice = cost / (1 - (marginRate / 100));
    setSellingPrice(Math.round(calculatedPrice / 100) * 100);
  }, [cost, marginRate]);

  useEffect(() => {
    const fetchMarketPrices = async () => {
      try {
        setLoading(true);
        // 1. 하루 1번 실시간 데이터 갱신 (캐싱 로직)
        let shouldInvoke = true;
        const { data: latestPrice, error: checkErr } = await supabase
          .from('market_prices')
          .select('target_date')
          .order('target_date', { ascending: false })
          .limit(1)
          .single();

        if (!checkErr && latestPrice?.target_date) {
          const targetDate = new Date(latestPrice.target_date);
          const now = new Date();
          // 오늘 날짜에 이미 생성된 데이터가 있다면 API 호출 생략
          if (targetDate.toDateString() === now.toDateString()) {
            shouldInvoke = false;
          }
        }

        if (shouldInvoke) {
          await supabase.functions.invoke('kamis-price-bot');
        }

        // 2. 최신 데이터 불러오기
        const { data, error } = await supabase
          .from('market_prices')
          .select('*')
          .order('target_date', { ascending: false })
          .limit(2);
          
        if (error) throw error;
        setMarketPrices(data || []);
      } catch (error) {
        console.error('Error fetching market prices:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarketPrices();
  }, []);

  // 원가율 = 100 - marginRate
  const costRate = 100 - marginRate;
  
  // 차트 데이터
  const data = [
    { name: '원가', value: costRate, color: '#94a3b8' },
    { name: '마진', value: marginRate, color: '#8b5cf6' },
  ];

  // 안전 게이지 색상
  const getStatusColor = () => {
    if (marginRate < 40) return 'text-rose-500 bg-rose-50 border-rose-200';
    if (marginRate < 60) return 'text-amber-500 bg-amber-50 border-amber-200';
    return 'text-emerald-500 bg-emerald-50 border-emerald-200';
  };
  
  const getStatusText = () => {
    if (marginRate < 40) return '마진 위험 (적자 우려)';
    if (marginRate < 60) return '보통 (마케팅 여력 부족)';
    return '안전 (건강한 수익 구조)';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col p-5 pb-24 min-h-screen bg-slate-50 relative"
    >
      <header className="mb-6 mt-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">스마트 프라이싱</h1>
          <p className="text-sm text-slate-500 mt-1">데이터 기반 메뉴 가격 설정 도구</p>
        </div>
      </header>

      {/* 실시간 시세 알림 (DB 연동) */}
      {marketPrices.map((item, idx) => (
        <div key={idx} className={`border rounded-2xl p-4 mb-4 flex items-start gap-3 shadow-sm ${item.trend === '상승' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <AlertTriangle className={`flex-shrink-0 ${item.trend === '상승' ? 'text-rose-500' : 'text-emerald-500'}`} size={20} />
          <div>
            <h3 className={`text-sm font-bold mb-1 ${item.trend === '상승' ? 'text-rose-800' : 'text-emerald-800'}`}>식자재 시세 경고 (KAMIS)</h3>
            <p className={`text-xs font-medium ${item.trend === '상승' ? 'text-rose-600' : 'text-emerald-600'}`}>
              최근 1개월간 '{item.item_name}' 도매가가 <span className="font-bold">{Math.abs(item.price_change_rate)}% {item.trend}</span>했습니다. 
              {item.trend === '상승' ? ' 원가를 재점검하세요.' : ' 마진율을 높일 기회입니다!'}
            </p>
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-6">
        {/* 입력 폼 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="mb-5">
            <label className="block text-sm font-bold text-slate-700 mb-2">메뉴 원가 (식자재 + 포장비 등)</label>
            <div className="relative">
              <input 
                type="number" 
                value={cost || ''}
                onChange={(e) => setCost(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-lg font-bold text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">원</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-slate-700">목표 마진율</label>
              <span className="text-lg font-bold text-violet-600">{marginRate}%</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="90" 
              step="1"
              value={marginRate}
              onChange={(e) => setMarginRate(Number(e.target.value))}
              className="w-full accent-violet-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer mb-2"
            />
            <div className="flex justify-between text-xs text-slate-400 font-medium px-1">
              <span>박리다매 (10%)</span>
              <span>프리미엄 (90%)</span>
            </div>
          </div>
        </div>

        {/* 결과 대시보드 */}
        <div className="bg-slate-900 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
            <Calculator size={100} />
          </div>
          
          <h3 className="text-slate-400 font-medium text-sm mb-2 flex items-center gap-1.5">
            ✨ AI 추천 판매가
          </h3>
          <div className="text-4xl font-bold tracking-tight mb-6">
            {sellingPrice.toLocaleString()} <span className="text-xl font-medium text-slate-400">원</span>
          </div>

          <div className="flex items-center gap-6 mt-6">
            <div className="w-24 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1">
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border inline-block mb-3 ${getStatusColor()}`}>
                {getStatusText()}
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400 font-medium">원가율</span>
                <span className="font-bold">{costRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-violet-300 font-medium">순이익</span>
                <span className="font-bold text-violet-300">{(sellingPrice - cost).toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
