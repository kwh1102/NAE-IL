import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, AlertTriangle, Calculator, ChevronRight, CheckSquare, Square, FileText, Plus, X, Repeat, ReceiptText, Edit3, Power, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  type ExpenseRecord,
  type RecurringExpenseTemplate,
  type WeeklyProofChecklist,
  expenseCategories,
  getLocalDateString,
  getMonthRange,
  getWeekRange,
  isMissingTableError,
  proofTaskTitles,
  readStoredExpenses,
  readStoredProofItems,
  readStoredTemplates,
  writeStoredExpenses,
  writeStoredProofItems,
  writeStoredTemplates,
} from '../lib/proofRoutine';

let isInsertingChecklists = false;

type DailyBusinessLog = {
  id: string;
  log_date: string;
  total_sales_amount: number;
  customer_count: number;
  weather: string;
  special_event_memo: string | null;
  business_memo: string | null;
  source: 'manual' | 'pos' | 'card_import';
};

const weatherOptions = ['맑음', '흐림', '비', '눈', '폭염', '한파'];
const parseAmountInput = (value: string) => Number(value.replace(/,/g, '')) || 0;
const getDemoLogStorageKey = (storeId: string) => `openSignal.dailyBusinessLogs.${storeId}`;

const readDemoLogs = (storeId: string) => {
  try {
    return JSON.parse(localStorage.getItem(getDemoLogStorageKey(storeId)) || '[]') as DailyBusinessLog[];
  } catch {
    return [];
  }
};

const writeDemoLog = (storeId: string, nextLog: DailyBusinessLog) => {
  const nextLogs = [nextLog, ...readDemoLogs(storeId)].sort((a, b) => b.log_date.localeCompare(a.log_date));
  localStorage.setItem(getDemoLogStorageKey(storeId), JSON.stringify(nextLogs));
  return nextLogs;
};

const isMissingDailyLogsTable = (error: any) =>
  error?.message?.includes('daily_business_logs') ||
  error?.message?.includes('schema cache') ||
  error?.code === 'PGRST205';

export default function Manage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [scheduleData, setScheduleData] = useState<Record<string, any[]>>({});
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskStaff, setRiskStaff] = useState<{name: string, hours: number} | null>(null);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringExpenseTemplate[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [proofItems, setProofItems] = useState<WeeklyProofChecklist[]>([]);
  const [businessLogs, setBusinessLogs] = useState<DailyBusinessLog[]>([]);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [logMessage, setLogMessage] = useState('');
  const [dailyLogForm, setDailyLogForm] = useState({
    totalSalesAmount: '',
    customerCount: '',
    weather: '맑음',
    specialEventMemo: '',
    businessMemo: '',
  });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: '임대료',
    amount: '',
    billingDay: '1',
    memo: '',
  });
  const [proofMessage, setProofMessage] = useState('');
  
  // 모달 상태
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: '', day: '월', start: '09:00', end: '14:00', type: '오전알바' });

  // Generate a week of dates
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const weekRange = getWeekRange();
  const monthRange = getMonthRange();

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

  const fetchProofRoutine = async () => {
    if (!user) return;

    const { data: templateData, error: templateError } = await supabase
      .from('recurring_expense_templates')
      .select('id, name, category, amount, billing_day, is_active, memo')
      .eq('store_id', user.id)
      .order('created_at', { ascending: false });

    if (templateError && isMissingTableError(templateError)) {
      setRecurringTemplates(readStoredTemplates(user.id));
    } else if (!templateError && templateData) {
      setRecurringTemplates(templateData as RecurringExpenseTemplate[]);
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .select('id, expense_date, category, amount, vendor, memo, receipt_status, recurring_template_id')
      .eq('store_id', user.id)
      .gte('expense_date', monthRange.start)
      .lte('expense_date', monthRange.end)
      .order('expense_date', { ascending: false });

    if (expenseError && isMissingTableError(expenseError)) {
      setExpenses(readStoredExpenses(user.id).filter((item) => item.expense_date >= monthRange.start && item.expense_date <= monthRange.end));
    } else if (!expenseError && expenseData) {
      setExpenses(expenseData as ExpenseRecord[]);
    }

    const { data: proofData, error: proofError } = await supabase
      .from('weekly_proof_checklists')
      .select('id, week_start, task_title, is_completed')
      .eq('store_id', user.id)
      .eq('week_start', weekRange.start)
      .order('created_at', { ascending: true });

    if (proofError && isMissingTableError(proofError)) {
      setProofItems(readStoredProofItems(user.id, weekRange.start));
    } else if (!proofError && proofData) {
      if (proofData.length > 0) {
        setProofItems(proofData as WeeklyProofChecklist[]);
      } else {
        const defaults = proofTaskTitles.map((taskTitle) => ({
          store_id: user.id,
          week_start: weekRange.start,
          task_title: taskTitle,
          is_completed: false,
        }));
        const { data: inserted } = await supabase
          .from('weekly_proof_checklists')
          .insert(defaults)
          .select('id, week_start, task_title, is_completed');
        setProofItems((inserted || defaults.map((item) => ({
          id: `${weekRange.start}-${item.task_title}`,
          week_start: item.week_start,
          task_title: item.task_title,
          is_completed: item.is_completed,
        }))) as WeeklyProofChecklist[]);
      }
    }
  };

  const refreshBusinessLogs = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('daily_business_logs')
      .select('id, log_date, total_sales_amount, customer_count, weather, special_event_memo, business_memo, source')
      .eq('store_id', user.id)
      .gte('log_date', monthRange.start)
      .lte('log_date', monthRange.end)
      .order('log_date', { ascending: false });

    const logs = error && isMissingDailyLogsTable(error)
      ? readDemoLogs(user.id)
      : (!error && data ? data as DailyBusinessLog[] : []);

    setBusinessLogs(logs);

    const todayLog = logs.find((log) => log.log_date === getLocalDateString());
    if (todayLog) {
      setDailyLogForm({
        totalSalesAmount: todayLog.total_sales_amount ? String(todayLog.total_sales_amount) : '',
        customerCount: todayLog.customer_count ? String(todayLog.customer_count) : '',
        weather: todayLog.weather || '맑음',
        specialEventMemo: todayLog.special_event_memo || '',
        businessMemo: todayLog.business_memo || '',
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        await fetchSchedules();
        await fetchProofRoutine();
        await refreshBusinessLogs();

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
  const unrecordedTemplates = recurringTemplates.filter((template) =>
    template.is_active &&
    !expenses.some((expense) =>
      expense.recurring_template_id === template.id &&
      expense.expense_date >= monthRange.start &&
      expense.expense_date <= monthRange.end
    )
  );
  const weeklyReceiptNeeds = expenses.filter((expense) =>
    expense.expense_date >= weekRange.start &&
    expense.expense_date <= weekRange.end &&
    (expense.receipt_status === 'missing' || expense.receipt_status === 'pending')
  );
  const completedProofCount = proofItems.filter((item) => item.is_completed).length;
  const proofCompletionRate = proofItems.length > 0 ? Math.round((completedProofCount / proofItems.length) * 100) : 0;

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

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateForm({ name: '', category: '임대료', amount: '', billingDay: '1', memo: '' });
  };

  const handleEditTemplate = (template: RecurringExpenseTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      category: template.category,
      amount: String(template.amount),
      billingDay: String(template.billing_day),
      memo: template.memo || '',
    });
  };

  const handleSaveTemplate = async () => {
    if (!user || !templateForm.name.trim()) return;
    const nextTemplate = {
      id: editingTemplateId || `${user.id}-template-${Date.now()}`,
      name: templateForm.name.trim(),
      category: templateForm.category,
      amount: Number(templateForm.amount) || 0,
      billing_day: Math.min(Math.max(Number(templateForm.billingDay) || 1, 1), 31),
      is_active: true,
      memo: templateForm.memo.trim() || null,
    };

    if (editingTemplateId) {
      const { error } = await supabase
        .from('recurring_expense_templates')
        .update({
          name: nextTemplate.name,
          category: nextTemplate.category,
          amount: nextTemplate.amount,
          billing_day: nextTemplate.billing_day,
          memo: nextTemplate.memo,
        })
        .eq('id', editingTemplateId);

      if (error && isMissingTableError(error)) {
        const next = readStoredTemplates(user.id).map((item) => item.id === editingTemplateId ? nextTemplate : item);
        setRecurringTemplates(writeStoredTemplates(user.id, next));
      } else {
        await fetchProofRoutine();
      }
    } else {
      const { data, error } = await supabase
        .from('recurring_expense_templates')
        .insert({
          store_id: user.id,
          name: nextTemplate.name,
          category: nextTemplate.category,
          amount: nextTemplate.amount,
          billing_day: nextTemplate.billing_day,
          is_active: true,
          memo: nextTemplate.memo,
        })
        .select('id, name, category, amount, billing_day, is_active, memo')
        .single();

      if (error && isMissingTableError(error)) {
        setRecurringTemplates(writeStoredTemplates(user.id, [nextTemplate, ...readStoredTemplates(user.id)]));
      } else if (!error && data) {
        setRecurringTemplates([data as RecurringExpenseTemplate, ...recurringTemplates]);
      }
    }

    resetTemplateForm();
  };

  const handleToggleTemplateActive = async (template: RecurringExpenseTemplate) => {
    if (!user) return;
    const { error } = await supabase
      .from('recurring_expense_templates')
      .update({ is_active: !template.is_active })
      .eq('id', template.id);

    if (error && isMissingTableError(error)) {
      const next = readStoredTemplates(user.id).map((item) => item.id === template.id ? { ...item, is_active: !item.is_active } : item);
      setRecurringTemplates(writeStoredTemplates(user.id, next));
    } else {
      setRecurringTemplates((prev) => prev.map((item) => item.id === template.id ? { ...item, is_active: !item.is_active } : item));
    }
  };

  const handleDeleteTemplate = async (template: RecurringExpenseTemplate) => {
    if (!user) return;
    if (!confirm(`${template.name} 반복 지출을 삭제할까요?`)) return;

    const { error } = await supabase
      .from('recurring_expense_templates')
      .delete()
      .eq('id', template.id);

    if (error && isMissingTableError(error)) {
      const next = readStoredTemplates(user.id).filter((item) => item.id !== template.id);
      setRecurringTemplates(writeStoredTemplates(user.id, next));
    } else if (!error) {
      setRecurringTemplates((prev) => prev.filter((item) => item.id !== template.id));
    }

    if (editingTemplateId === template.id) {
      resetTemplateForm();
    }
  };

  const handleRecordRecurringExpense = async (template: RecurringExpenseTemplate) => {
    if (!user) return;
    const expenseDate = getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), Math.min(template.billing_day, 28)));
    const nextExpense = {
      id: `${user.id}-expense-${Date.now()}`,
      expense_date: expenseDate,
      category: template.category,
      amount: template.amount,
      vendor: template.name,
      memo: template.memo,
      receipt_status: 'pending' as const,
      recurring_template_id: template.id,
    };

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        store_id: user.id,
        expense_date: nextExpense.expense_date,
        category: nextExpense.category,
        amount: nextExpense.amount,
        vendor: nextExpense.vendor,
        memo: nextExpense.memo,
        receipt_status: nextExpense.receipt_status,
        recurring_template_id: nextExpense.recurring_template_id,
      })
      .select('id, expense_date, category, amount, vendor, memo, receipt_status, recurring_template_id')
      .single();

    if (error && isMissingTableError(error)) {
      const next = [nextExpense, ...readStoredExpenses(user.id)];
      setExpenses(writeStoredExpenses(user.id, next).filter((item) => item.expense_date >= monthRange.start && item.expense_date <= monthRange.end));
    } else if (!error && data) {
      setExpenses([data as ExpenseRecord, ...expenses]);
    }
  };

  const handleSaveDailyLog = async () => {
    if (!user) return;
    const totalSalesAmount = parseAmountInput(dailyLogForm.totalSalesAmount);
    const customerCount = parseAmountInput(dailyLogForm.customerCount);

    if (totalSalesAmount <= 0) {
      setLogMessage('오늘 매출을 먼저 입력해주세요.');
      return;
    }

    setIsSavingLog(true);
    setLogMessage('');

    try {
      const nextLog = {
        id: `${user.id}-${getLocalDateString()}-${Date.now()}`,
        log_date: getLocalDateString(),
        total_sales_amount: totalSalesAmount,
        customer_count: customerCount,
        weather: dailyLogForm.weather,
        special_event_memo: dailyLogForm.specialEventMemo.trim() || null,
        business_memo: dailyLogForm.businessMemo.trim() || null,
        source: 'manual' as const,
      };

      const { error } = await supabase
        .from('daily_business_logs')
        .upsert({
          store_id: user.id,
          log_date: nextLog.log_date,
          total_sales_amount: nextLog.total_sales_amount,
          customer_count: nextLog.customer_count,
          weather: nextLog.weather,
          special_event_memo: nextLog.special_event_memo,
          business_memo: nextLog.business_memo,
          source: 'manual',
        }, { onConflict: 'store_id,log_date' });

      if (error) {
        if (isMissingDailyLogsTable(error)) {
          setBusinessLogs(writeDemoLog(user.id, nextLog));
          setLogMessage('오늘 마감 기록을 저장했어요.');
          return;
        }
        throw error;
      }

      await refreshBusinessLogs();
      setLogMessage('오늘 마감 기록을 저장했어요.');
    } catch (error: any) {
      console.error('하루 마감 기록 저장 실패:', error);
      setLogMessage(`저장에 실패했어요. ${error.message || '잠시 후 다시 시도해주세요.'}`);
    } finally {
      setIsSavingLog(false);
    }
  };

  const toggleProofItem = async (item: WeeklyProofChecklist) => {
    if (!user) return;
    const nextCompleted = !item.is_completed;
    const { error } = await supabase
      .from('weekly_proof_checklists')
      .update({ is_completed: nextCompleted })
      .eq('id', item.id);

    if (error && isMissingTableError(error)) {
      const next = proofItems.map((proofItem) => proofItem.id === item.id ? { ...proofItem, is_completed: nextCompleted } : proofItem);
      setProofItems(writeStoredProofItems(user.id, weekRange.start, next));
    } else {
      setProofItems((prev) => prev.map((proofItem) => proofItem.id === item.id ? { ...proofItem, is_completed: nextCompleted } : proofItem));
    }
    setProofMessage(nextCompleted ? '체크했어요. 이번 주 정리가 조금 더 가벼워졌어요.' : '');
  };

  const updateExpenseReceiptStatus = async (expense: ExpenseRecord, receiptStatus: ExpenseRecord['receipt_status']) => {
    if (!user) return;
    const { error } = await supabase
      .from('expenses')
      .update({ receipt_status: receiptStatus })
      .eq('id', expense.id);

    if (error && isMissingTableError(error)) {
      const next = readStoredExpenses(user.id).map((item) => item.id === expense.id ? { ...item, receipt_status: receiptStatus } : item);
      setExpenses(writeStoredExpenses(user.id, next).filter((item) => item.expense_date >= monthRange.start && item.expense_date <= monthRange.end));
    } else {
      setExpenses((prev) => prev.map((item) => item.id === expense.id ? { ...item, receipt_status: receiptStatus } : item));
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

      <section className="mb-8">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">하루 마감 기록</h2>
              <p className="text-xs text-slate-500 mt-1">장사가 끝난 뒤 매출과 상황만 짧게 남겨요.</p>
            </div>
            {businessLogs.some((log) => log.log_date === getLocalDateString()) && (
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                <CheckCircle2 size={14} />
                기록됨
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">오늘 매출</span>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={dailyLogForm.totalSalesAmount}
                  onChange={(e) => setDailyLogForm({ ...dailyLogForm, totalSalesAmount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm font-semibold text-slate-800 focus:outline-none focus:border-violet-500"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">손님 수</span>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={dailyLogForm.customerCount}
                  onChange={(e) => setDailyLogForm({ ...dailyLogForm, customerCount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm font-semibold text-slate-800 focus:outline-none focus:border-violet-500"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">명</span>
              </div>
            </label>
          </div>

          <label className="flex flex-col gap-1 mb-3">
            <span className="text-xs font-bold text-slate-500">날씨</span>
            <select
              value={dailyLogForm.weather}
              onChange={(e) => setDailyLogForm({ ...dailyLogForm, weather: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-violet-500"
            >
              {weatherOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 mb-3">
            <span className="text-xs font-bold text-slate-500">특이사항</span>
            <input
              type="text"
              value={dailyLogForm.specialEventMemo}
              onChange={(e) => setDailyLogForm({ ...dailyLogForm, specialEventMemo: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-violet-500"
              placeholder="예: 학교 행사, 시험 기간, 근처 축제, 비 많이 옴, 단체 손님"
            />
          </label>

          <label className="flex flex-col gap-1 mb-4">
            <span className="text-xs font-bold text-slate-500">사장님 메모</span>
            <textarea
              value={dailyLogForm.businessMemo}
              onChange={(e) => setDailyLogForm({ ...dailyLogForm, businessMemo: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-violet-500 min-h-[74px] resize-none"
              placeholder="예: 특정 메뉴 품절, 알바 결근, 배달 많음"
            />
          </label>

          <button
            onClick={handleSaveDailyLog}
            disabled={isSavingLog}
            className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Save size={18} />
            {isSavingLog ? '저장 중...' : '오늘 마감 기록 저장'}
          </button>
          {logMessage && (
            <p className={`text-xs mt-3 text-center font-medium ${logMessage.includes('실패') || logMessage.includes('입력') ? 'text-rose-500' : 'text-emerald-600'}`}>
              {logMessage}
            </p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Repeat size={20} className="text-violet-600" /> 반복 지출
          </h2>
          {loading && <span className="text-xs font-medium text-slate-400">불러오는 중...</span>}
        </div>

        {unrecordedTemplates.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
            <p className="text-sm font-bold text-amber-800 mb-2">
              이번 달 {unrecordedTemplates[0].name} 기록이 필요해요.
            </p>
            <p className="text-xs text-amber-700 mb-3">
              반복 지출은 한 번만 등록해두면 매달 빠뜨리기 쉬운 비용을 다시 확인할 수 있어요.
            </p>
            <button
              onClick={() => handleRecordRecurringExpense(unrecordedTemplates[0])}
              className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-2 rounded-xl"
            >
              이번 달 지출로 기록
            </button>
          </div>
        )}

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">이름</span>
              <input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="예: 월 임대료"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">분류</span>
              <select
                value={templateForm.category}
                onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              >
                {expenseCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">금액</span>
              <input
                type="number"
                inputMode="numeric"
                value={templateForm.amount}
                onChange={(e) => setTemplateForm({ ...templateForm, amount: e.target.value })}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">매월 며칠</span>
              <input
                type="number"
                min="1"
                max="31"
                value={templateForm.billingDay}
                onChange={(e) => setTemplateForm({ ...templateForm, billingDay: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 mb-4">
            <span className="text-xs font-bold text-slate-500">메모</span>
            <input
              value={templateForm.memo}
              onChange={(e) => setTemplateForm({ ...templateForm, memo: e.target.value })}
              placeholder="예: 매월 자동이체"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSaveTemplate}
              disabled={!templateForm.name.trim()}
              className="flex-1 bg-violet-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {editingTemplateId ? '수정 저장' : '반복 지출 등록'}
            </button>
            {editingTemplateId && (
              <button onClick={resetTemplateForm} className="px-4 bg-slate-100 text-slate-600 font-bold rounded-xl">
                취소
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {recurringTemplates.length === 0 ? (
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-500 text-center">
              임대료나 통신비처럼 매달 반복되는 지출을 하나 등록해보세요.
            </div>
          ) : recurringTemplates.map((template) => (
            <div key={template.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-slate-800">{template.name}</p>
                    {!template.is_active && <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">비활성</span>}
                  </div>
                  <p className="text-xs text-slate-500">
                    {template.category} · 매월 {template.billing_day}일 · {template.amount.toLocaleString()}원
                  </p>
                  {template.memo && <p className="text-xs text-slate-400 mt-1">{template.memo}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditTemplate(template)} className="p-2 bg-slate-50 text-slate-500 rounded-lg">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleToggleTemplateActive(template)} className="p-2 bg-slate-50 text-slate-500 rounded-lg">
                    <Power size={16} />
                  </button>
                  <button onClick={() => handleDeleteTemplate(template)} className="p-2 bg-rose-50 text-rose-500 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ReceiptText size={20} className="text-emerald-600" /> 이번 주 증빙 정리
        </h2>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-slate-800">완료율 {proofCompletionRate}%</p>
              <p className="text-xs text-slate-500 mt-1">
                이번 주 증빙 확인이 필요한 지출이 {weeklyReceiptNeeds.length}건 있어요.
              </p>
            </div>
            <div className="text-right text-xs font-bold text-emerald-600">
              {completedProofCount}/{proofItems.length}
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-emerald-500" style={{ width: `${proofCompletionRate}%` }} />
          </div>
          <div className="flex flex-col gap-3">
            {proofItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleProofItem(item)}
                className="flex items-start gap-3 text-left"
              >
                {item.is_completed ? (
                  <CheckSquare className="text-emerald-600 shrink-0" size={22} />
                ) : (
                  <Square className="text-slate-300 shrink-0" size={22} />
                )}
                <span className={`text-sm font-bold ${item.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {item.task_title}
                </span>
              </button>
            ))}
          </div>
          {proofMessage && <p className="text-xs text-emerald-600 font-medium mt-4 text-center">{proofMessage}</p>}
        </div>

        {weeklyReceiptNeeds.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-sm font-bold text-emerald-800 mb-3">증빙 상태를 확인해볼 지출</p>
            <div className="flex flex-col gap-2">
              {weeklyReceiptNeeds.map((expense) => (
                <div key={expense.id} className="bg-white rounded-xl p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{expense.vendor || expense.category}</p>
                    <p className="text-xs text-slate-500">{expense.amount.toLocaleString()}원 · {expense.receipt_status === 'missing' ? '증빙 없음' : '확인 중'}</p>
                  </div>
                  <select
                    value={expense.receipt_status}
                    onChange={(e) => updateExpenseReceiptStatus(expense, e.target.value as ExpenseRecord['receipt_status'])}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600"
                  >
                    <option value="missing">없음</option>
                    <option value="pending">확인 중</option>
                    <option value="received">받음</option>
                    <option value="not_needed">필요 없음</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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
