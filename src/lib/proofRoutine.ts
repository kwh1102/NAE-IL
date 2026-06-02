export type RecurringExpenseTemplate = {
  id: string;
  name: string;
  category: string;
  amount: number;
  billing_day: number;
  is_active: boolean;
  memo: string | null;
};

export type ExpenseRecord = {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  vendor: string | null;
  memo: string | null;
  receipt_status: 'missing' | 'pending' | 'received' | 'not_needed';
  recurring_template_id: string | null;
};

export type WeeklyProofChecklist = {
  id: string;
  week_start: string;
  task_title: string;
  is_completed: boolean;
};

export const proofTaskTitles = [
  '식자재 영수증',
  '인건비 지급',
  '임대료/관리비',
  '공과금',
  '카드매출',
  '현금매출',
  '배달앱 정산',
  '기타 지출 확인',
];

export const expenseCategories = ['임대료', '통신비', '보험료', '정기 구독', '관리비', '공과금', '식자재', '인건비', '기타'];

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getWeekRange = (date = new Date()) => {
  const start = new Date(date);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: getLocalDateString(start),
    end: getLocalDateString(end),
  };
};

export const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: getLocalDateString(start),
    end: getLocalDateString(end),
  };
};

export const getNextCleanupDateLabel = () => {
  const today = new Date();
  const next = new Date(today);
  const daysUntilSunday = (7 - today.getDay()) % 7;
  next.setDate(today.getDate() + daysUntilSunday);
  return `${next.getMonth() + 1}월 ${next.getDate()}일`;
};

export const isMissingTableError = (error: any) =>
  error?.message?.includes('schema cache') ||
  error?.code === 'PGRST205' ||
  error?.code === '42P01';

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
};

const writeStored = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
};

export const storageKeys = {
  templates: (storeId: string) => `openSignal.recurringExpenseTemplates.${storeId}`,
  expenses: (storeId: string) => `openSignal.expenses.${storeId}`,
  proofItems: (storeId: string, weekStart: string) => `openSignal.weeklyProofChecklists.${storeId}.${weekStart}`,
};

export const readStoredTemplates = (storeId: string) =>
  readStored<RecurringExpenseTemplate[]>(storageKeys.templates(storeId), []);

export const writeStoredTemplates = (storeId: string, templates: RecurringExpenseTemplate[]) =>
  writeStored(storageKeys.templates(storeId), templates);

export const readStoredExpenses = (storeId: string) =>
  readStored<ExpenseRecord[]>(storageKeys.expenses(storeId), []);

export const writeStoredExpenses = (storeId: string, expenses: ExpenseRecord[]) =>
  writeStored(storageKeys.expenses(storeId), expenses);

export const readStoredProofItems = (storeId: string, weekStart: string) => {
  const stored = readStored<WeeklyProofChecklist[] | null>(storageKeys.proofItems(storeId, weekStart), null);
  if (stored) return stored;

  return proofTaskTitles.map((title) => ({
    id: `${weekStart}-${title}`,
    week_start: weekStart,
    task_title: title,
    is_completed: false,
  }));
};

export const writeStoredProofItems = (storeId: string, weekStart: string, items: WeeklyProofChecklist[]) =>
  writeStored(storageKeys.proofItems(storeId, weekStart), items);
