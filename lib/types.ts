export type TaskType = 'audit' | 'visit' | 'none';
export type StatusType = 'pending' | 'completed';

export interface Report {
  staff: string;
  date: string;
  interviewee: string;
  checkSalary?: 'ok' | 'ng' | 'none';
  checkLog?: 'ok' | 'ng' | 'none';
  remarks?: string;
  // Dual task fields
  vStaff?: string;
  vDate?: string;
  vInterviewee?: string;
}

export interface ScheduleCell {
  month: number;
  type: TaskType;
  status: StatusType;
  report?: Report;
}

export interface Enterprise {
  id: string;
  name: string;
  countTokutei: number;
  countJisshu23: number;
  countJisshu1: number;
  entryDateJisshu1: string; // YYYY-MM-DD
  acceptTypes?: string[]; // e.g., ['実習', '特定', '育成']
  respName?: string;
  respDate?: string;
  instrName?: string;
  instrDate?: string;
  lifeName?: string;
  lifeDate?: string;
  schedule: ScheduleCell[];
}

export interface SyncPayload {
  timestamp?: string;
  enterprises: Enterprise[];
  cache: Record<number, Record<string, ScheduleCell[]>>;
  reports?: Record<string, unknown>[]; // For legacy GAS processing if needed
}
