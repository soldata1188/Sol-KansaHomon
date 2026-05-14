import { useState, useEffect, useRef, useCallback } from 'react';
import { Enterprise, ScheduleCell, Report, TaskType, StatusType, SortColumn } from '@/lib/types';
import { SYNC_API_URL, EMPTY_REPORT } from '@/lib/constants';
import { calculateSchedule } from '@/lib/utils';

// Helper: always read latest enterprises from ref to avoid stale closures

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
  // Always store latest enterprises so syncToCloud() without args reads fresh data
  const enterprisesRef = useRef<Enterprise[]>([]);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'audit' | 'visit' | 'pending' | 'month'>('all');
  const [viewMode, setViewMode] = useState<'schedule' | 'training'>('schedule');
  const [sortColumn, setSortColumn] = useState<SortColumn>('entryDateJisshu1');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
      const baseSchedule = calculateSchedule();
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

  const syncToCloud = useCallback(async (overrideEnts?: Enterprise[], removedCells?: { enterprise_id: string; fiscal_year: number; month: number }[]) => {
    // Always read from ref so we never use a stale closure value
    const data = overrideEnts || enterprisesRef.current;
    if (data.length === 0) return;
    // NOTE: No concurrent-sync guard — Supabase upserts are idempotent.
    // A guard here would silently block user-triggered saves when an auto-sync
    // is in flight, causing data loss on page refresh.
    setIsSyncing(true);

    try {
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

      const now = new Date();
      const currentFiscalYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
      const payload = {
        timestamp: new Date().toISOString(),
        enterprises: data,
        cache: cacheRef.current,
        currentFiscalYear,
        reports,
        removedCells: removedCells || []
      };

      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log('✅ 同期完了');
      } else {
        console.error('❌ 同期失敗 status:', response.status);
      }
    } catch (e) {
      console.error('❌ 同期エラー:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — reads enterprises from ref, not closure

  useEffect(() => {
    const safeGetSession = (key: string): string | null => {
      try { return sessionStorage.getItem(key); } catch { return null; }
    };
    const safeGetLocal = (key: string): string | null => {
      try { return localStorage.getItem(key); } catch { return null; }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (safeGetSession('isLoggedIn') === 'true') setIsAuthenticated(true);

    const now = new Date();
    setFocusMonth(now.getMonth() + 1);
    const currentFY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    setFiscalYear(currentFY);

    const loadData = async () => {
      setIsSyncing(true);
      let isCloudSuccess = false;
      let finalEnts: Enterprise[] = [];
      let finalCache: Record<number, Record<string, ScheduleCell[]>> = {};

      try {
        const response = await fetch(SYNC_API_URL, { cache: 'no-store' });
        if (response.ok) {
          const cloudData = await response.json();
          finalEnts = cloudData?.enterprises || [];
          // Normalize cache keys to numbers to prevent string/number key mismatch
          const rawCache = cloudData?.cache || {};
          Object.keys(rawCache).forEach(yearStr => {
            const yearNum = Number(yearStr);
            finalCache[yearNum] = rawCache[yearStr];
          });
          isCloudSuccess = true;
          
          try { localStorage.setItem('sol_enterprises', JSON.stringify(finalEnts)); } catch { /* silent */ }
          try { localStorage.setItem('sol_cache', JSON.stringify(finalCache)); } catch { /* silent */ }
        }
      } catch (e) { console.warn('Cloud fetch failed', e); }

      if (!isCloudSuccess) {
        try {
          const savedEntsRaw = safeGetLocal('sol_enterprises');
          const savedCacheRaw = safeGetLocal('sol_cache');
          finalEnts = savedEntsRaw ? JSON.parse(savedEntsRaw) : [];
          finalCache = savedCacheRaw ? JSON.parse(savedCacheRaw) : {};
        } catch (e) { console.warn('Local storage fetch failed', e); }
      }

      if (finalEnts.length > 0 || isCloudSuccess) {
        cacheRef.current = finalCache;
        const sorted = finalEnts.sort((a, b) => {
          if (!a.entryDateJisshu1 && !b.entryDateJisshu1) return a.name.localeCompare(b.name, 'ja');
          if (!a.entryDateJisshu1) return 1;
          if (!b.entryDateJisshu1) return -1;
          const dateCompare = b.entryDateJisshu1.localeCompare(a.entryDateJisshu1);
          if (dateCompare !== 0) return dateCompare;
          return a.name.localeCompare(b.name, 'ja');
        });
        const withSchedule = loadScheduleWithReports(currentFY, sorted);
        enterprisesRef.current = withSchedule;
        setEnterprises(withSchedule);
      }
      setIsSyncing(false);
      setIsInitialLoadDone(true);
    };

    loadData();
  }, [loadScheduleWithReports]);

  // --- Refresh from Cloud (manual) ---
  const refreshFromCloud = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(SYNC_API_URL, { cache: 'no-store' });
      if (response.ok) {
        const cloudData = await response.json();
        const cloudEnts: Enterprise[] = cloudData?.enterprises || [];
        const cloudCache: Record<number, Record<string, ScheduleCell[]>> = {};
        const rawCache = cloudData?.cache || {};
        Object.keys(rawCache).forEach(yearStr => {
          cloudCache[Number(yearStr)] = rawCache[yearStr];
        });

        cacheRef.current = cloudCache;
        const currentFY = new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1;
        const sorted = cloudEnts.sort((a, b) => {
          if (!a.entryDateJisshu1 && !b.entryDateJisshu1) return a.name.localeCompare(b.name, 'ja');
          if (!a.entryDateJisshu1) return 1;
          if (!b.entryDateJisshu1) return -1;
          const dateCompare = b.entryDateJisshu1.localeCompare(a.entryDateJisshu1);
          if (dateCompare !== 0) return dateCompare;
          return a.name.localeCompare(b.name, 'ja');
        });
        const withSchedule = loadScheduleWithReports(currentFY, sorted);
        // BUG FIX 5: Update ref BEFORE setEnterprises so auto-sync effect reads correct data
        enterprisesRef.current = withSchedule;
        setEnterprises(withSchedule);

        try { localStorage.setItem('sol_enterprises', JSON.stringify(cloudEnts)); } catch { /* silent */ }
        try { localStorage.setItem('sol_cache', JSON.stringify(cloudCache)); } catch { /* silent */ }
        console.log('🔄 クラウドから再読み込み完了');
      }
    } catch (e) {
      console.error('❌ 再読み込みエラー:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [loadScheduleWithReports]);

  // Sync Effect — BUG FIX 1 & 5: keep enterprisesRef always current; syncToCloud reads from ref
  useEffect(() => {
    if (!isAuthenticated || !isInitialLoadDone || enterprises.length === 0) return;
    // Always update ref so syncToCloud() without args gets the freshest data
    enterprisesRef.current = enterprises;
    try { localStorage.setItem('sol_enterprises', JSON.stringify(enterprises)); } catch { /* silent */ }
    try { localStorage.setItem('sol_cache', JSON.stringify(cacheRef.current)); } catch { /* silent */ }

    const timeoutId = setTimeout(() => syncToCloud(), 2000);
    return () => clearTimeout(timeoutId);
  // syncToCloud is stable (no enterprise dependency anymore), so this runs only when enterprises changes
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

    // Compute sorted list outside of setEnterprises to avoid side-effects in updater
    const current = enterprises;
    let next: Enterprise[];
    if (!targetEnt.id) {
      const fullNewEnt = { ...targetEnt, id: 'ENT' + Date.now(), name: trimmed, schedule: calculateSchedule() };
      next = [...current, fullNewEnt];
    } else {
      next = current.map(e => (e.id === targetEnt.id ? { ...e, ...targetEnt, name: trimmed, schedule: e.schedule } : e));
    }
    const sorted = next.sort((a, b) => {
      if (!a.entryDateJisshu1 && !b.entryDateJisshu1) return a.name.localeCompare(b.name, 'ja');
      if (!a.entryDateJisshu1) return 1;
      if (!b.entryDateJisshu1) return -1;
      const dateCompare = b.entryDateJisshu1.localeCompare(a.entryDateJisshu1);
      if (dateCompare !== 0) return dateCompare;
      return a.name.localeCompare(b.name, 'ja');
    });
    enterprisesRef.current = sorted;
    setEnterprises(sorted);
    setModalMode('none');
    // Sync immediately with explicit data — do NOT rely on 2s debounce
    syncToCloud(sorted);
  };

  const handleDeleteEnterprise = (ent: Enterprise) => {
    if (!confirm(`「${ent.name}」を削除します。よろしいですか？`)) return;
    const newCache = { ...cacheRef.current };
    Object.keys(newCache).forEach(year => { if (newCache[Number(year)]) delete newCache[Number(year)][ent.id]; });
    cacheRef.current = newCache;
    const updatedEnts = enterprises.filter(e => e.id !== ent.id);
    enterprisesRef.current = updatedEnts;
    setEnterprises(updatedEnts);
    setModalMode('none');
    // Delete from DB directly, then sync the updated enterprise list
    fetch('/api/delete-enterprise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ent.id }) }).catch(() => {});
    syncToCloud(updatedEnts);
  };

  const handleSaveReport = () => {
    if (!selectedCell) return;
    // For 'audit' tasks, completed when either audit date or visit date is filled.
    // For 'visit' tasks, completed when visit date is filled.
    const isActuallyCompleted = selectedCell.type === 'audit'
      ? (!!tempReport.date || !!tempReport.vDate)
      : !!tempReport.date;
    const newStatus: StatusType = isActuallyCompleted ? 'completed' : 'pending';

    // Compute updated list outside state updater to avoid side-effects
    const updated = enterprises.map(ent => {
      if (ent.id !== selectedCell.entId) return ent;
      return { ...ent, schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, status: newStatus, report: tempReport } : c) };
    });
    saveCurrentToCache(fiscalYear, updated);
    enterprisesRef.current = updated;
    setEnterprises(updated);
    setModalMode('none');
    // Sync immediately — do NOT rely on 2s debounce
    syncToCloud(updated);
  };

  const handleSetType = (newType: TaskType) => {
    if (!selectedCell) return;
    const updated = enterprises.map(ent => {
      if (ent.id !== selectedCell.entId) return ent;
      return { ...ent, schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, type: newType, status: 'pending' as StatusType, report: { ...EMPTY_REPORT } } : c) };
    });
    saveCurrentToCache(fiscalYear, updated);
    enterprisesRef.current = updated;
    setEnterprises(updated);
    setModalMode('none');
    syncToCloud(updated);
  };

  const handleSetTypeDirect = (entId: string, month: number, newType: TaskType) => {
    const updated = enterprises.map(ent => {
      if (ent.id !== entId) return ent;
      return { ...ent, schedule: ent.schedule.map(c => c.month === month ? { ...c, type: newType, status: 'pending' as StatusType, report: { ...EMPTY_REPORT } } : c) };
    });
    saveCurrentToCache(fiscalYear, updated);
    enterprisesRef.current = updated;
    setEnterprises(updated);
    syncToCloud(updated);
  };

  const handleRemoveSchedule = () => {
    if (!selectedCell || !confirm('解除しますか？')) return;
    const cellToRemove = { enterprise_id: selectedCell.entId, fiscal_year: fiscalYear, month: selectedCell.month };
    const updated = enterprises.map(ent => {
      if (ent.id !== selectedCell.entId) return ent;
      return { ...ent, schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, type: 'none' as TaskType, status: 'pending' as StatusType, report: { ...EMPTY_REPORT } } : c) };
    });
    saveCurrentToCache(fiscalYear, updated);
    enterprisesRef.current = updated;
    setEnterprises(updated);
    setModalMode('none');
    syncToCloud(updated, [cellToRemove]);
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

  const sortedAndFilteredEnterprises = [...filteredEnterprises].sort((a, b) => {
    // Always push tokutei-only enterprises to the bottom
    const aIsTokuteiOnly = a.acceptTypes?.length === 1 && a.acceptTypes[0] === '特定';
    const bIsTokuteiOnly = b.acceptTypes?.length === 1 && b.acceptTypes[0] === '特定';
    if (aIsTokuteiOnly && !bIsTokuteiOnly) return 1;
    if (!aIsTokuteiOnly && bIsTokuteiOnly) return -1;

    let cmp = 0;
    if (sortColumn === 'name') {
      cmp = a.name.localeCompare(b.name, 'ja');
    } else if (sortColumn === 'acceptTypes') {
      const aTypes = a.acceptTypes?.join(',') || '';
      const bTypes = b.acceptTypes?.join(',') || '';
      cmp = aTypes.localeCompare(bTypes, 'ja');
    } else if (sortColumn === 'countForeigners') {
      const aCount = a.countTokutei + a.countJisshu23;
      const bCount = b.countTokutei + b.countJisshu23;
      cmp = aCount - bCount;
    } else if (sortColumn === 'countJisshu1') {
      cmp = a.countJisshu1 - b.countJisshu1;
    } else if (sortColumn === 'entryDateJisshu1') {
      // Empty dates always go to bottom regardless of sort direction
      if (!a.entryDateJisshu1 && !b.entryDateJisshu1) cmp = 0;
      else if (!a.entryDateJisshu1) return 1;
      else if (!b.entryDateJisshu1) return -1;
      else cmp = a.entryDateJisshu1.localeCompare(b.entryDateJisshu1);
    }
    
    // Apply direction to primary sort
    let finalCmp = sortDirection === 'asc' ? cmp : -cmp;
    
    // Absolute Tie-breakers (always applied in a fixed direction regardless of sortDirection)
    if (finalCmp === 0) {
      // 1st tie-breaker: entryDate (Newest on top, empties at bottom)
      const aDate = a.entryDateJisshu1 || '';
      const bDate = b.entryDateJisshu1 || '';
      if (!aDate && !bDate) finalCmp = 0;
      else if (!aDate) finalCmp = 1;
      else if (!bDate) finalCmp = -1;
      else finalCmp = bDate.localeCompare(aDate);
      
      // 2nd tie-breaker: name (A-Z)
      if (finalCmp === 0) {
        finalCmp = a.name.localeCompare(b.name, 'ja');
      }
    }
    
    return finalCmp;
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      // 'name' and 'acceptTypes' default to A-Z (asc). Numbers and dates default to highest/newest (desc).
      setSortDirection(column === 'name' || column === 'acceptTypes' ? 'asc' : 'desc');
    }
  };

  return {
    isAuthenticated, password, setPassword, loginError, handleLogin, logout,
    enterprises, filteredEnterprises: sortedAndFilteredEnterprises, fiscalYear, focusMonth, setFocusMonth, realMonth, realFiscalYear,
    modalMode, setModalMode, targetEnt, setTargetEnt, selectedCell, setSelectedCell,
    tempReport, setTempReport,
    isSyncing, syncToCloud, refreshFromCloud,
    searchTerm, setSearchTerm, filterMode, setFilterMode, viewMode, setViewMode,
    sortColumn, sortDirection, handleSort,
    changeFiscalYear, handleSaveEnterprise, handleDeleteEnterprise, handleSaveReport,
    handleSetType, handleSetTypeDirect, handleRemoveSchedule, openChecklist
  };
}
