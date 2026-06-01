import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, AlertTriangle, Calculator, ChevronRight, CheckSquare, Square, FileText, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

let isInsertingChecklists = false;

export default function Manage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [scheduleData, setScheduleData] = useState<Record<string, any[]>>({});
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskStaff, setRiskStaff] = useState<{name: string, hours: number} | null>(null);
  
  // 모달 상태
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: '', day: '월', start: '09:00', end: '14:00', type: '오전알바' });

  // Generate a week of dates
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const fetchSchedules = async () => {
    if (!user) return;
    try {
      const { data: sData, error: sError } = await supabase
        .from('schedules')
        .select('*')
        .eq('store_id', user.id);
        
      if (sError) throw sError;
      
      const grouped: Record<string, any[]> = {};
      const staffHours: Record<string, number> = {};
      
      if (sData) {
        sData.forEach(item => {
          if (!grouped[item.day_of_week]) grouped[item.day_of_week] = [];
          grouped[item.day_of_week].push({
            id: item.id,
            name: item.staff_name,
            time: `${item.start_time.substring(0,5)} - ${item.end_time.substring(0,5)}`,
            type: item.shift_type
          });
          
          const start = new Date(`1970-01-01T${item.start_time}`);
          const end = new Date(`1970-01-01T${item.end_time}`);
          let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          if (diff < 0) diff += 24;
          
          if (!staffHours[item.staff_name]) staffHours[item.staff_name] = 0;
          staffHours[item.staff_name] += diff;
        });
      }
      setScheduleData(grouped);
      
      let highestRisk = null;
      for (const [name, hours] of Object.entries(staffHours)) {
        if (hours >= 14) {
          if (!highestRisk || hours > highestRisk.hours) {
            highestRisk = { name, hours };
          }
        }
      }
      setRiskStaff(highestRisk);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        await fetchSchedules();

        // 2. 체크리스트 가져오기
        const { data: cData, error: cError } = await supabase
          .from('tax_checklists')
          .select('*')
          .eq('store_id', user.id)
          .order('deadline', { ascending: true });
          
        if (cError) throw cError;
        
        let currentChecklists = cData || [];
        
        // 데이터가 없으면 기본값 생성
        if (currentChecklists.length === 0 && !isInsertingChecklists) {
          isInsertingChecklists = true;
          const defaultChecklists = [
            { store_id: user.id, task_title: '종합소득세 신고 준비', task_desc: '홈택스에서 신고 안내문 확인 및 자료 수집', deadline: '2026-05-31', is_completed: false },
            { store_id: user.id, task_title: '직원 원천세 신고', task_desc: '이번 달 급여 지급분에 대한 원천세 납부', deadline: '2026-06-10', is_completed: false },
            { store_id: user.id, task_title: '부가세 예정 고지 확인', task_desc: '국세청 우편물 확인 및 납부서 출력', deadline: '2026-06-25', is_completed: false }
          ];
          
          await supabase.from('tax_checklists').insert(defaultChecklists);
          
          // 다시 불러오기
          const { data: newData } = await supabase
            .from('tax_checklists')
            .select('*')
            .eq('store_id', user.id)
            .order('deadline', { ascending: true });
            
          currentChecklists = newData || [];
        }
        
        setChecklists(currentChecklists);
        
      } catch (error) {
        console.error('Error fetching manage data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user?.id]);

  const selectedDayLabel = format(selectedDate, 'E', { locale: ko });
  const todaysSchedule = scheduleData[selectedDayLabel] || [];

  const toggleChecklist = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tax_checklists')
        .update({ is_completed: !currentStatus })
        .eq('id', id);
        
      if (!error) {
        setChecklists(prev => prev.map(c => c.id === id ? { ...c, is_completed: !currentStatus } : c));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSchedule = async () => {
    if (!user || !newSchedule.name) return;
    try {
      const { error } = await supabase.from('schedules').insert({
        store_id: user.id,
        staff_name: newSchedule.name,
        day_of_week: newSchedule.day,
        start_time: newSchedule.start,
        end_time: newSchedule.end,
        shift_type: newSchedule.type
      });
      
      if (!error) {
        setIsScheduleModalOpen(false);
        setNewSchedule({ name: '', day: '월', start: '09:00', end: '14:00', type: '오전알바' });
        await fetchSchedules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (!error) {
        await fetchSchedules();
      } else {
        alert('삭제 실패: ' + error.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col p-5 pb-24 min-h-screen bg-slate-50 relative"
    >
      <header className="mb-6 mt-2">
        <h1 className="text-xl font-bold text-slate-800">고정비 & 운영 관리</h1>
        <p className="text-sm text-slate-500 mt-1">AI가 추천하는 효율적인 매장 운영</p>
      </header>

      {/* 스마트 프라이싱 배너 */}
      <button 
        onClick={() => navigate('/pricing')}
        className="w-full bg-slate-900 text-white rounded-3xl p-6 mb-8 flex justify-between items-center shadow-lg active:scale-95 transition-transform"
      >
        <div className="text-left">
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-bold mb-2">
            <Calculator size={14} /> AI 유틸리티
          </div>
          <h2 className="text-lg font-bold mb-1">스마트 프라이싱 계산기</h2>
          <p className="text-sm text-slate-400 font-medium">실시간 원가율 점검 및 가격 설정</p>
        </div>
        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
          <ChevronRight size={24} />
        </div>
      </button>

      {/* 노무 리스크 관리 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <AlertTriangle size={20} className="text-rose-500"/> 이번 주 노무 리스크
        </h2>
        {riskStaff ? (
          <div className="bg-rose-50 border border-rose-200 p-5 rounded-3xl flex gap-3 items-start shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <AlertTriangle size={80} />
            </div>
            <div className="relative z-10 w-full">
              <h4 className="font-bold text-rose-800 text-[15px] mb-2">주휴수당 발생 임박 알림</h4>
              <div className="bg-white p-3 rounded-2xl border border-rose-100 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">
                    {riskStaff.name}
                  </span>
                  <span className="text-rose-600 font-bold text-sm">누적 {riskStaff.hours.toFixed(1)}시간 근무</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${Math.min((riskStaff.hours / 15) * 100, 100)}%` }}></div>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  이번 주 <b>주 15시간 이상 근무</b>에 도달할 위험이 높습니다. 주휴수당 지급 의무가 발생할 수 있으니 스케줄을 확인하세요.
                </p>
                <button 
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="mt-2 w-full bg-rose-100 text-rose-700 font-bold py-2 rounded-xl text-xs hover:bg-rose-200 transition-colors"
                >
                  스케줄 재조정 캘린더 열기
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-100 border border-slate-200 p-5 rounded-3xl flex items-center justify-center shadow-sm">
            <p className="text-slate-500 font-medium text-sm">이번 주 주휴수당 발생 위험이 있는 직원이 없습니다.</p>
          </div>
        )}
      </section>

      {/* 가로 스크롤 캘린더 및 알바 배치도 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock size={20} className="text-violet-600"/> 효율적 알바 스케줄링
          </h2>
          <button 
            onClick={() => setIsScheduleModalOpen(true)}
            className="text-violet-600 bg-violet-100 hover:bg-violet-200 p-2 rounded-full transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar snap-x border-b border-slate-100">
            {weekDays.map((date, idx) => {
              const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              const dayLabel = format(date, 'E', { locale: ko });
              const dayNum = format(date, 'd');
              const isWeekend = dayLabel === '토' || dayLabel === '일';
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`snap-center flex-shrink-0 w-[52px] h-[72px] rounded-2xl flex flex-col items-center justify-center transition-all ${isSelected ? 'bg-violet-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  <span className={`text-[11px] font-bold mb-1 ${!isSelected && isWeekend ? (dayLabel === '일' ? 'text-rose-500' : 'text-blue-500') : ''}`}>{dayLabel}</span>
                  <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{dayNum}</span>
                </button>
              );
            })}
          </div>
          
          <div className="p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">{format(selectedDate, 'M월 d일 (E)', { locale: ko })} 스케줄</h3>
            <div className="flex flex-col gap-3">
              {todaysSchedule.map((staff, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-sm">
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[15px]">{staff.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{staff.time}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteSchedule(staff.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600">
                    {staff.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 세무 체크리스트 */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText size={20} className="text-blue-600"/> 이번 달 세무 체크리스트
        </h2>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex flex-col gap-4">
            {checklists.map((item, idx) => (
              <div key={item.id || idx} className="flex items-start gap-3 cursor-pointer group" onClick={() => toggleChecklist(item.id, item.is_completed)}>
                {item.is_completed ? (
                  <CheckSquare className="text-violet-600 shrink-0 group-hover:scale-110 transition-transform" size={22} />
                ) : (
                  <Square className="text-slate-300 shrink-0 group-hover:text-violet-400 group-hover:scale-110 transition-transform" size={22} />
                )}
                <div className={item.is_completed ? 'opacity-50 line-through' : ''}>
                  <p className="font-bold text-slate-800 text-sm">
                    {item.task_title} <span className="text-xs text-slate-400 font-normal ml-1">({format(new Date(item.deadline), 'M.d')}까지)</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.task_desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* 스케줄 추가 모달 */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-5">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">새 스케줄 추가</h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-50 p-1.5 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">알바생 이름</label>
                <input type="text" value={newSchedule.name} onChange={e => setNewSchedule({...newSchedule, name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 bg-slate-50" placeholder="이름 입력" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">요일</label>
                  <select value={newSchedule.day} onChange={e => setNewSchedule({...newSchedule, day: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 bg-slate-50">
                    {['월','화','수','목','금','토','일'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">근무 타임</label>
                  <select value={newSchedule.type} onChange={e => setNewSchedule({...newSchedule, type: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 bg-slate-50">
                    <option>오전알바</option>
                    <option>오후알바</option>
                    <option>마감알바</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">시작 시간</label>
                  <input type="time" value={newSchedule.start} onChange={e => setNewSchedule({...newSchedule, start: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 bg-slate-50" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">종료 시간</label>
                  <input type="time" value={newSchedule.end} onChange={e => setNewSchedule({...newSchedule, end: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 bg-slate-50" />
                </div>
              </div>
            </div>
            <div className="p-5 pt-2">
              <button 
                onClick={handleAddSchedule}
                className="w-full bg-violet-600 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                disabled={!newSchedule.name}
              >
                저장하기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
