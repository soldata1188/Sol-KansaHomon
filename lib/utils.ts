import { MONTHS } from './constants';
import { ScheduleCell, TaskType, StatusType } from './types';

export const formatShortDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
};

export const calculateSchedule = (): ScheduleCell[] => {
  // All cells start empty. Users assign 監査/訪問 manually.
  return MONTHS.map(m => ({ month: m, type: 'none' as TaskType, status: 'pending' as StatusType }));
};

export const getTrainingStatus = (dateStr?: string) => {
  if (!dateStr) return { text: '未設定', color: '#94a3b8', bg: '#f1f5f9', isWarning: false };
  const date = new Date(dateStr);
  const now = new Date();
  const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  
  if (diffMonths >= 36) {
    return { text: '期限切れ', color: '#dc2626', bg: '#fef2f2', isWarning: true };
  } else if (diffMonths >= 33) {
    return { text: '更新間近', color: '#d97706', bg: '#fffbeb', isWarning: true };
  }
  return { text: '有効', color: '#16a34a', bg: '#f0fdf4', isWarning: false };
};
