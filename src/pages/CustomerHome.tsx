import { motion } from 'framer-motion';
import { MapPin, Search, Ticket, Flame, ChevronRight } from 'lucide-react';

const mockStores = [
  {
    id: 1,
    name: '오픈시그널 카페',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=600&auto=format&fit=crop',
    discount: '10%',
    desc: '대학 축제 기념 전 메뉴 할인',
    distance: '150m'
  },
  {
    id: 2,
    name: '동네 빵집',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop',
    discount: '3,000원',
    desc: '오후 7시 마감 세일 진행 중',
    distance: '320m'
  }
];

export default function CustomerHome() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24"
    >
      {/* Header */}
      <header className="bg-white px-5 py-4 shadow-sm z-10 sticky top-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-1">
            <MapPin size={20} className="text-emerald-600" />
            우리동네 혜택
          </h1>
          <button className="text-slate-400 hover:text-emerald-600 transition-colors">
            <Search size={24} />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="단골 매장이나 혜택을 검색해보세요" 
            className="w-full bg-slate-100 text-sm py-2.5 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </header>

      {/* Hero Banner */}
      <div className="p-5">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 p-2 opacity-20">
            <Ticket size={100} />
          </div>
          <p className="text-emerald-100 font-medium mb-1 text-sm">놓치면 아쉬운</p>
          <h2 className="text-2xl font-bold mb-3 leading-snug">오늘 우리동네<br/>마감 세일 모음</h2>
          <button className="bg-white/20 hover:bg-white/30 transition-colors px-4 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm">
            바로가기
          </button>
        </div>
      </div>

      {/* Store Feed */}
      <section className="px-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
            <Flame size={20} className="text-rose-500" />
            지금 뜨는 매장 혜택
          </h3>
          <button className="text-sm font-medium text-emerald-600 flex items-center">
            전체보기 <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {mockStores.map(store => (
            <div key={store.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col active:scale-[0.98] transition-transform">
              <div className="h-40 bg-slate-200 relative">
                <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 bg-rose-500 text-white font-bold px-2.5 py-1 rounded-lg text-sm shadow-md">
                  {store.discount} 할인
                </div>
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1">
                  <MapPin size={12} /> {store.distance}
                </div>
              </div>
              <div className="p-4">
                <h4 className="font-bold text-slate-800 mb-1">{store.name}</h4>
                <p className="text-sm text-slate-500">{store.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </motion.div>
  );
}
