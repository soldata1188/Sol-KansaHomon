import { useState, useEffect, useRef, useCallback } from 'react';
import { Enterprise, ScheduleCell, Report, TaskType, StatusType } from '@/lib/types';
import { MONTHS, SYNC_API_URL, EMPTY_REPORT } from '@/lib/constants';
import { calculateSchedule } from '@/lib/utils';

export function useAuditSystem() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [focusMonth, setFocusMonth] = useState(new Date().getMonth() + 1);
  const [realMonth] = useState(new Date().getMonth() + 1);
  const [realFiscalYear] = useState(new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  
  const [modalMode, setModalMode] = useState<'none' | 'add' | 'edit' | 'checklist' | 'settype'>('none');
  const [targetEnt, setTargetEnt] = useState<Enterprise>({ id: '', name: '', countTokutei: 0, countJisshu23: 0, countJisshu1: 0, entryDateJisshu1: '', schedule: [] });
  const [selectedCell, setSelectedCell] = useState<{ entId: string; month: number; type: TaskType } | null>(null);
  
  const [tempReport, setTempReport] = useState<Report>(EMPTY_REPORT);
  
  const cacheRef = useRef<Record<number, Record<string, ScheduleCell[]>>>({});
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'audit' | 'visit' | 'pending' | 'month'>('all');
  const [viewMode, setViewMode] = useState<'schedule' | 'training'>('schedule');

  // --- Auth Logic ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setIsAuthenticated(true);
        try { sessionStorage.setItem('isLoggedIn', 'true'); } catch { /* silent */ }
        setLoginError(false);
      } else {
        setLoginError(true);
      }
    } catch {
      setLoginError(true);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('isLoggedIn');
    window.location.reload();
  };

  // --- Data Loading ---
  const loadScheduleWithReports = useCallback((year: number, ents: Enterprise[]): Enterprise[] => {
    const yearCache = cacheRef.current[year] || {};
    return ents.map(ent => {
      const baseSchedule = calculateSchedule(ent, year);
      const cached = yearCache[ent.id];
      const merged = baseSchedule.map(baseCell => {
        const found = cached?.find(c => c.month === baseCell.month);
        if (found && (found.type !== 'none' || found.status === 'completed')) {
          return { ...baseCell, type: found.type, status: found.status, report: found.report };
        }
        return baseCell;
      });
      return { ...ent, schedule: merged };
    });
  }, []);

  const syncToCloud = useCallback(async (overrideEnts?: Enterprise[]) => {
    const data = overrideEnts || enterprises;
    if (data.length === 0) return;
    setIsSyncing(true);

    try {
      // Build a flat reports array for easy GAS processing
      const reports = data.flatMap(ent =>
        ent.schedule
          .filter(c => c.status === 'completed' && c.report)
          .map(c => ({
            entId: ent.id,
            entName: ent.name,
            month: c.month,
            type: c.type,
            staff: c.report?.staff || '',
            date: c.report?.date || '',
            interviewee: c.report?.interviewee || '',
            checkSalary: c.report?.checkSalary || '',
            checkLog: c.report?.checkLog || '',
            vStaff: c.report?.vStaff || '',
            vDate: c.report?.vDate || '',
            vInterviewee: c.report?.vInterviewee || '',
            remarks: c.report?.remarks || ''
          }))
      );

      const payload = {
        timestamp: new Date().toISOString(),
        enterprises: data,
        cache: cacheRef.current,
        reports
      };

      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log('✅ 同期完了');
      }
    } catch (e) {
      console.error('❌ 同期エラー:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  }, [enterprises]);

  useEffect(() => {
    const safeGetSession = (key: string): string | null => {
      try { return sessionStorage.getItem(key); } catch { return null; }
    };
    const safeGetLocal = (key: string): string | null => {
      try { return localStorage.getItem(key); } catch { return null; }
    };

    if (safeGetSession('isLoggedIn') === 'true') setIsAuthenticated(true);

    const now = new Date();
    setFocusMonth(now.getMonth() + 1);
    const currentFY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    setFiscalYear(currentFY);

    const loadData = async () => {
      setIsSyncing(true);
      let cloudEnts: Enterprise[] = [];
      let cloudCache: Record<string, Record<string, ScheduleCell[]>> = {};

      try {
        const response = await fetch(SYNC_API_URL, { cache: 'no-store' });
        if (response.ok) {
          const cloudData = await response.json();
          cloudEnts = cloudData?.enterprises || [];
          cloudCache = cloudData?.cache || {};
        }
      } catch (e) { console.warn('Cloud fetch failed', e); }

      let localEnts: Enterprise[] = [];
      let localCache: Record<string, Record<string, ScheduleCell[]>> = {};
      try {
        const savedEntsRaw = safeGetLocal('sol_enterprises');
        const savedCacheRaw = safeGetLocal('sol_cache');
        localEnts = savedEntsRaw ? JSON.parse(savedEntsRaw) : [];
        localCache = savedCacheRaw ? JSON.parse(savedCacheRaw) : {};
      } catch (e) { console.warn('Local storage fetch failed', e); }

      // Merge & Sort
      const mergedEntsMap = new Map<string, Enterprise>();
      cloudEnts.forEach((ent: Enterprise) => mergedEntsMap.set(ent.id, ent));
      localEnts.forEach((le: Enterprise) => { if (!mergedEntsMap.has(le.id)) mergedEntsMap.set(le.id, le); });
      const mergedEnts = Array.from(mergedEntsMap.values());

      const mergedCache = { ...cloudCache };
      Object.keys(localCache).forEach(year => {
        if (!mergedCache[year]) mergedCache[year] = localCache[year];
        else {
          Object.keys(localCache[year]).forEach(entId => {
            if (!mergedCache[year][entId]) mergedCache[year][entId] = localCache[year][entId];
          });
        }
      });

      if (mergedEnts.length > 0) {
        cacheRef.current = mergedCache;
        const sorted = mergedEnts.sort((a, b) => {
          if (!a.entryDateJisshu1 && !b.entryDateJisshu1) return a.name.localeCompare(b.name, 'ja');
          if (!a.entryDateJisshu1) return 1;
          if (!b.entryDateJisshu1) return -1;
          return b.entryDateJisshu1.localeCompare(a.entryDateJisshu1);
        });
        setEnterprises(loadScheduleWithReports(currentFY, sorted));
      }
      setIsSyncing(false);
      setIsInitialLoadDone(true);
    };

    loadData();
  }, [loadScheduleWithReports]);

  // Sync Effect
  useEffect(() => {
    if (!isAuthenticated || !isInitialLoadDone || enterprises.length === 0) return;
    try { localStorage.setItem('sol_enterprises', JSON.stringify(enterprises)); } catch { /* silent */ }
    try { localStorage.setItem('sol_cache', JSON.stringify(cacheRef.current)); } catch { /* silent */ }

    const timeoutId = setTimeout(() => syncToCloud(), 2000);
    return () => clearTimeout(timeoutId);
  }, [enterprises, isAuthenticated, isInitialLoadDone, syncToCloud]);

  // --- Logic Functions ---

  const saveCurrentToCache = (year: number, ents: Enterprise[]) => {
    const yearCache: Record<string, ScheduleCell[]> = {};
    ents.forEach(ent => { yearCache[ent.id] = ent.schedule; });
    cacheRef.current[year] = yearCache;
  };

  const changeFiscalYear = (newFY: number) => {
    if (newFY === fiscalYear) return;
    saveCurrentToCache(fiscalYear, enterprises);
    const updated = loadScheduleWithReports(newFY, enterprises);
    setFiscalYear(newFY);
    setEnterprises(updated);
  };

  const handleSaveEnterprise = () => {
    if (!targetEnt.name.trim()) return;
    const trimmed = targetEnt.name.trim();
    const duplicate = enterprises.find(e => e.name.toLowerCase() === trimmed.toLowerCase() && e.id !== targetEnt.id);
    if (duplicate) {
      alert(`「${trimmed}」はすでに登録されています。`);
      return;
    }

    setEnterprises(prev => {
      let next;
      if (!targetEnt.id) {
        const fullNewEnt = { ...targetEnt, id: 'ENT' + Date.now(), name: trimmed, schedule: calculateSchedule(targetEnt, fiscalYear) };
        next = [...prev, fullNewEnt];
      } else {
        next = prev.map(e => (e.id === targetEnt.id ? { ...e, ...targetEnt, name: trimmed, schedule: calculateSchedule(targetEnt, fiscalYear) } : e));
      }
      return next.sort((a, b) => {
        if (!a.entryDateJisshu1 && !b.entryDateJisshu1) return a.name.localeCompare(b.name, 'ja');
        if (!a.entryDateJisshu1) return 1;
        if (!b.entryDateJisshu1) return -1;
        return b.entryDateJisshu1.localeCompare(a.entryDateJisshu1);
      });
    });
    setModalMode('none');
  };

  const handleDeleteEnterprise = (ent: Enterprise) => {
    if (!confirm(`「${ent.name}」を削除します。よろしいですか？`)) return;
    const newCache = { ...cacheRef.current };
    Object.keys(newCache).forEach(year => { if (newCache[Number(year)]) delete newCache[Number(year)][ent.id]; });
    cacheRef.current = newCache;
    const updatedEnts = enterprises.filter(e => e.id !== ent.id);
    setEnterprises(updatedEnts);
    setModalMode('none');
    fetch('/api/delete-enterprise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ent.id }) }).catch(() => {});
  };

  const handleSaveReport = () => {
    if (!selectedCell) return;
    const isActuallyCompleted = !!tempReport.date;
    const newStatus: StatusType = isActuallyCompleted ? 'completed' : 'pending';

    setEnterprises(prev => {
      const updated = prev.map(ent => {
        if (ent.id !== selectedCell.entId) return ent;
        return { ...ent, schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, status: newStatus, report: tempReport } : c) };
      });
      saveCurrentToCache(fiscalYear, updated);
      setTimeout(() => syncToCloud(), 500);
      return updated;
    });
    setModalMode('none');
  };

  const handleAutoFillAudits = () => {
    if (!confirm(`${fiscalYear}年度の「監査」スケジュールを自動補完しますか？\n（過去の監査日または入国日を基準に3ヶ月ごとに設定します）`)) return;
    let updatedCount = 0;
    const newCache = { ...cacheRef.current };
    const getScheduleForYear = (ent: Enterprise, year: number) => {
      if (!newCache[year]) newCache[year] = {};
      if (!newCache[year][ent.id]) newCache[year][ent.id] = calculateSchedule(ent, year);
      return newCache[year][ent.id];
    };

    enterprises.forEach(ent => {
      let anchorDate: Date | null = null;

      // Priority 1: Find the latest completed audit in history
      Object.keys(newCache).forEach(y => {
        newCache[Number(y)][ent.id]?.forEach(cell => {
          if (cell.type === 'audit' && cell.status === 'completed' && cell.report?.date) {
            const d = new Date(cell.report.date);
            if (!anchorDate || d > anchorDate) anchorDate = d;
          }
        });
      });

      // Priority 2: If no completed audit, find the earliest pending audit in the current year
      if (!anchorDate) {
        const currentSch = getScheduleForYear(ent, fiscalYear);
        for (const cell of currentSch) {
          if (cell.type === 'audit') {
            const y = cell.month >= 4 ? fiscalYear : fiscalYear + 1;
            anchorDate = new Date(y, cell.month - 1, 15); // Approximate middle of the month
            break;
          }
        }
      }

      // Priority 3: If still no anchor, use the 1st-year entry date
      if (!anchorDate && ent.entryDateJisshu1) {
        anchorDate = new Date(ent.entryDateJisshu1);
      }

      // If absolutely no reference point, skip this enterprise
      if (!anchorDate) return;

      const targetMaxDate = new Date(fiscalYear + 1, 2, 31); // End of current fiscal year
      let nextDate = new Date(anchorDate);
      let safety = 0;
      
      while (nextDate <= targetMaxDate && safety < 100) {
        safety++;
        nextDate.setMonth(nextDate.getMonth() + 3); // Advance by 3 months
        
        const y = nextDate.getFullYear();
        const m = nextDate.getMonth() + 1;
        const fy = m >= 4 ? y : y - 1;
        
        // Only autofill the currently viewed fiscal year
        if (fy !== fiscalYear) continue;

        const sch = getScheduleForYear(ent, fy);
        const cell = sch.find(c => c.month === m);
        
        // Overwrite if it's empty OR if it's a pending visit
        if (cell && (cell.type === 'none' || (cell.type === 'visit' && cell.status === 'pending'))) {
          cell.type = 'audit'; 
          cell.status = 'pending'; 
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      cacheRef.current = newCache;
      const updatedEnts = loadScheduleWithReports(fiscalYear, enterprises);
      setEnterprises(updatedEnts);
      setTimeout(() => syncToCloud(updatedEnts), 500);
      alert(`${updatedCount}件の「監査」を自動補完しました。`);
    } else {
      alert('補完するスケジュールがありませんでした。基準となるデータ（過去の監査日や入国日）を確認してください。');
    }
  };

  const handleAutoFillVisits = () => {
    if (!confirm(`${fiscalYear}年度の空き月に「訪問」スケジュールを自動補完しますか？\n（監査がある月や受入人数が0の企業は除外されます）`)) return;
    let updatedCount = 0;
    const newCache = { ...cacheRef.current };
    const getScheduleForYear = (ent: Enterprise, year: number) => {
      if (!newCache[year]) newCache[year] = {};
      if (!newCache[year][ent.id]) newCache[year][ent.id] = calculateSchedule(ent, year);
      return newCache[year][ent.id];
    };

    enterprises.forEach(ent => {
      // Only schedule visits if the enterprise has active trainees
      const totalTrainees = ent.countTokutei + ent.countJisshu23 + ent.countJisshu1;
      if (totalTrainees === 0 && !ent.entryDateJisshu1) return;

      const sch = getScheduleForYear(ent, fiscalYear);
      sch.forEach(cell => {
        // Smart Logic: Fill gaps. If the month is empty, fill with Visit.
        if (cell.type === 'none') {
          cell.type = 'visit';
          cell.status = 'pending';
          updatedCount++;
        }
      });
    });

    if (updatedCount > 0) {
      cacheRef.current = newCache;
      const updatedEnts = loadScheduleWithReports(fiscalYear, enterprises);
      setEnterprises(updatedEnts);
      setTimeout(() => syncToCloud(updatedEnts), 500);
      alert(`${updatedCount}件の「訪問」を自動補完しました。`);
    } else {
      alert('補完する空きスケジュールがありませんでした。');
    }
  };

  const handleSetType = (newType: TaskType) => {
    if (!selectedCell) return;
    setEnterprises(prev => {
      const updated = prev.map(ent => {
        if (ent.id !== selectedCell.entId) return ent;
        return { ...ent, schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, type: newType, status: 'pending' as StatusType, report: undefined } : c) };
      });
      saveCurrentToCache(fiscalYear, updated);
      return updated;
    });
    setModalMode('none');
  };

  const handleRemoveSchedule = () => {
    if (!selectedCell || !confirm('解除しますか？')) return;
    setEnterprises(prev => {
      const updated = prev.map(ent => {
        if (ent.id !== selectedCell.entId) return ent;
        return { ...ent, schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, type: 'none' as TaskType, status: 'pending' as StatusType, report: undefined } : c) };
      });
      saveCurrentToCache(fiscalYear, updated);
      return updated;
    });
    setModalMode('none');
  };

  const openChecklist = (ent: Enterprise, month: number, type: TaskType) => {
    const cell = ent.schedule.find(c => c.month === month);
    setSelectedCell({ entId: ent.id, month, type });
    if (type === 'none') setModalMode('settype');
    else {
      setTempReport(cell?.report ? { ...cell.report } : { ...EMPTY_REPORT });
      setModalMode('checklist');
    }
  };

  const filteredEnterprises = enterprises.filter(ent => {
    const matchesSearch = ent.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (viewMode === 'training') return matchesSearch;
    if (filterMode === 'all') return matchesSearch;

    const focusMonthData = ent.schedule.find(c => c.month === focusMonth);
    if (filterMode === 'audit') return matchesSearch && focusMonthData?.type === 'audit';
    if (filterMode === 'visit') return matchesSearch && focusMonthData?.type === 'visit';
    if (filterMode === 'pending') return matchesSearch && focusMonthData?.type !== 'none' && focusMonthData?.status === 'pending';
    if (filterMode === 'month') return matchesSearch && focusMonthData?.type !== 'none';
    
    return matchesSearch;
  });

  return {
    isAuthenticated, password, setPassword, loginError, handleLogin, logout,
    enterprises, filteredEnterprises, fiscalYear, focusMonth, setFocusMonth, realMonth, realFiscalYear,
    modalMode, setModalMode, targetEnt, setTargetEnt, selectedCell, setSelectedCell,
    tempReport, setTempReport,
    isSyncing, syncToCloud,
    searchTerm, setSearchTerm, filterMode, setFilterMode, viewMode, setViewMode,
    changeFiscalYear, handleSaveEnterprise, handleDeleteEnterprise, handleSaveReport,
    handleAutoFillAudits, handleAutoFillVisits, handleSetType, handleRemoveSchedule, openChecklist
  };
}
