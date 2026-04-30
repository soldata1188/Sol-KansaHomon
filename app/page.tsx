'use client';

import React, { useState, useEffect, useRef } from 'react';

// --- Types & Constants ---
type TaskType = 'audit' | 'visit' | 'none';
type StatusType = 'pending' | 'completed';

interface Report {
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

interface ScheduleCell {
  month: number;
  type: TaskType;
  status: StatusType;
  report?: Report;
}

interface Enterprise {
  id: string;
  name: string;
  countTokutei: number;
  countJisshu23: number;
  countJisshu1: number;
  entryDateJisshu1: string; // YYYY-MM-DD
  respName?: string;
  respDate?: string;
  instrName?: string;
  instrDate?: string;
  lifeName?: string;
  lifeDate?: string;
  schedule: ScheduleCell[];
}

const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

// --- Utilities ---

const formatShortDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
};

// --- Logic: Schedule (Manual only — no auto-generation) ---
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const calculateSchedule = (_ent: Enterprise, _fiscalYear: number): ScheduleCell[] => {
  // All cells start empty. Users assign 監査/訪問 manually.
  return MONTHS.map(m => ({ month: m, type: 'none' as TaskType, status: 'pending' as StatusType }));
};

// --- Main Component ---
export default function AuditSystem() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  
  const [modalMode, setModalMode] = useState<'none' | 'add' | 'edit' | 'checklist' | 'settype'>('none');
  const [targetEnt, setTargetEnt] = useState<Enterprise>({ id: '', name: '', countTokutei: 0, countJisshu23: 0, countJisshu1: 0, entryDateJisshu1: '', schedule: [] });
  const [selectedCell, setSelectedCell] = useState<{ entId: string; month: number; type: TaskType } | null>(null);
  
  const emptyReport: Report = { staff: '', date: '', interviewee: '', checkSalary: 'none', checkLog: 'none', remarks: '', vStaff: '', vDate: '', vInterviewee: '' };
  const [tempReport, setTempReport] = useState<Report>(emptyReport);
  
  const cacheRef = useRef<Record<number, Record<string, ScheduleCell[]>>>({});
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'audit' | 'visit' | 'pending'>('all');
  const [viewMode, setViewMode] = useState<'schedule' | 'training'>('schedule');
  const scrollRef = useRef<HTMLDivElement | HTMLTableRowElement | null>(null);

  // Use Next.js API proxy to avoid CORS issues with direct GAS calls
  const SYNC_API_URL = '/api/sync';

  // --- Search Scroll Effect ---
  useEffect(() => {
    if (searchTerm && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchTerm]);

  useEffect(() => {
    // Safe wrapper for storage access (fails in some private browsers)
    const safeGetSession = (key: string): string | null => {
      try { return sessionStorage.getItem(key); } catch { return null; }
    };
    const safeGetLocal = (key: string): string | null => {
      try { return localStorage.getItem(key); } catch { return null; }
    };

    const auth = safeGetSession('isLoggedIn');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (auth === 'true') setIsAuthenticated(true);

    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    const currentFY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    setFiscalYear(currentFY);

    const loadData = async () => {
      setIsSyncing(true);
      let cloudEnts: Enterprise[] = [];
      let cloudCache: Record<string, Record<string, ScheduleCell[]>> = {};

      // Step 1: Fetch from Cloud via server-side proxy (no CORS issues)
      try {
        const response = await fetch(SYNC_API_URL, { cache: 'no-store' });
        if (response.ok) {
          const cloudData = await response.json();
          cloudEnts = cloudData?.enterprises || [];
          cloudCache = cloudData?.cache || {};
          console.log(`☁️ クラウドから ${cloudEnts.length} 件を読み込みました`);
        }
      } catch (e) {
        console.warn('クラウドからの読み込みに失敗しました（ローカルを使用します）:', e);
      }

      // Step 2: Try to read from LocalStorage (non-fatal if fails)
      let localEnts: Enterprise[] = [];
      let localCache: Record<string, Record<string, ScheduleCell[]>> = {};
      try {
        const savedEntsRaw = safeGetLocal('sol_enterprises');
        const savedCacheRaw = safeGetLocal('sol_cache');
        localEnts = savedEntsRaw ? JSON.parse(savedEntsRaw) : [];
        localCache = savedCacheRaw ? JSON.parse(savedCacheRaw) : {};
      } catch (e) {
        console.warn('ローカルストレージの読み込みに失敗しました:', e);
      }

      // Step 3: Smart Merge
      try {
        const mergedEntsMap = new Map<string, Enterprise>();
        cloudEnts.forEach((ent: Enterprise) => mergedEntsMap.set(ent.id, ent));
        localEnts.forEach((le: Enterprise) => {
          if (!mergedEntsMap.has(le.id)) mergedEntsMap.set(le.id, le);
        });
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
      } catch (e) {
        console.error('データのマージに失敗しました:', e);
      } finally {
        // Always complete initialization so the app renders
        setIsSyncing(false);
        setIsInitialLoadDone(true);
      }
    };

    loadData();
  }, []);

  // Sync Effect
  useEffect(() => {
    if (!isAuthenticated || !isInitialLoadDone || enterprises.length === 0) return;
    try { localStorage.setItem('sol_enterprises', JSON.stringify(enterprises)); } catch { /* silent */ }
    try { localStorage.setItem('sol_cache', JSON.stringify(cacheRef.current)); } catch { /* silent */ }

    const timeoutId = setTimeout(() => syncToCloud(), 2000);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterprises, isAuthenticated, isInitialLoadDone]);

  async function syncToCloud(overrideEnts?: Enterprise[]) {
    const data = overrideEnts || enterprises;
    if (data.length === 0) return;
    setIsSyncing(true);
    console.log('🔄 同期を開始します...', { count: data.length });

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
        reports  // flat array — GAS reads this directly
      };

      console.log(`📊 Reports to sync: ${reports.length}`);

      // POST to our own Next.js API proxy (no CORS issues)
      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ 同期完了:', result.message);
      } else {
        console.warn('⚠️ 同期レスポンスエラー:', response.status);
      }
    } catch (e) {
      console.error('❌ 同期エラー:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  function loadScheduleWithReports(year: number, ents: Enterprise[]): Enterprise[] {
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
  };

  const saveCurrentToCache = (year: number, ents: Enterprise[]) => {
    const yearCache: Record<string, ScheduleCell[]> = {};
    ents.forEach(ent => { yearCache[ent.id] = ent.schedule; });
    cacheRef.current[year] = yearCache;
  };

  const changeFiscalYear = (delta: number) => {
    const newFY = fiscalYear + delta;
    if (newFY < 2025) return;
    saveCurrentToCache(fiscalYear, enterprises);
    const updated = loadScheduleWithReports(newFY, enterprises);
    setFiscalYear(newFY);
    setEnterprises(updated);
  };

  const handleSaveEnterprise = () => {
    if (!targetEnt.name.trim()) return;

    // Duplicate name check
    const trimmed = targetEnt.name.trim();
    const duplicate = enterprises.find(e =>
      e.name.toLowerCase() === trimmed.toLowerCase() && e.id !== targetEnt.id
    );
    if (duplicate) {
      alert(`「${trimmed}」はすでに登録されています。企業名の重複はできません。`);
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
    if (!confirm(`「${ent.name}」を削除します。\nこの企業の全スケジュール・報告も削除されます。\n本当に削除しますか？`)) return;

    // Remove from cache
    const newCache = { ...cacheRef.current };
    Object.keys(newCache).forEach(year => {
      if (newCache[Number(year)]) delete newCache[Number(year)][ent.id];
    });
    cacheRef.current = newCache;

    const updatedEnts = enterprises.filter(e => e.id !== ent.id);
    try {
      localStorage.setItem('sol_enterprises', JSON.stringify(updatedEnts));
      localStorage.setItem('sol_cache', JSON.stringify(newCache));
    } catch { /* silent */ }

    // Delete from Supabase
    fetch('/api/delete-enterprise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ent.id })
    }).catch(() => { /* silent */ });

    setEnterprises(updatedEnts);
    setModalMode('none');
  };

  const handleSaveReport = () => {

    if (!selectedCell) return;
    setEnterprises(prev => {
      const updated = prev.map(ent => {
        if (ent.id !== selectedCell.entId) return ent;
        return {
          ...ent,
          schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, status: 'completed' as StatusType, report: tempReport } : c)
        };
      });
      saveCurrentToCache(fiscalYear, updated);
      // Sync immediately after report save
      setTimeout(() => syncToCloud(), 500);
      return updated;
    });
    setModalMode('none');
  };

  const handleAutoFillAudits = () => {
    if (!confirm('直近の監査実施日に基づき、3ヶ月ごとに監査スケジュールを自動補完しますか？\n（未完了の「訪問」予定がある場合は、「監査」として上書きされます）')) return;

    let updatedCount = 0;
    const newCache = { ...cacheRef.current };

    const getScheduleForYear = (ent: Enterprise, year: number) => {
      if (!newCache[year]) newCache[year] = {};
      if (!newCache[year][ent.id]) {
        newCache[year][ent.id] = calculateSchedule(ent, year);
      }
      return newCache[year][ent.id];
    };

    enterprises.forEach(ent => {
      let latestDate: Date | null = null;
      
      // Search across all years in cache
      Object.keys(newCache).forEach(yearStr => {
        const sch = newCache[Number(yearStr)][ent.id];
        if (sch) {
          sch.forEach(cell => {
            if (cell.type === 'audit' && cell.status === 'completed' && cell.report?.date) {
              const d = new Date(cell.report.date);
              if (!latestDate || d > latestDate) latestDate = d;
            }
          });
        }
      });

      // Also check current active enterprises array just in case
      ent.schedule.forEach(cell => {
        if (cell.type === 'audit' && cell.status === 'completed' && cell.report?.date) {
          const d = new Date(cell.report.date);
          if (!latestDate || d > latestDate) latestDate = d;
        }
      });

      if (!latestDate) return;

      const targetMaxDate = new Date(fiscalYear + 1, 2, 31); // March 31 of next year
      let nextDate = new Date(latestDate);
      let safetyCounter = 0;
      
      while (nextDate <= targetMaxDate && safetyCounter < 100) {
        safetyCounter++;
        nextDate.setMonth(nextDate.getMonth() + 3);
        
        const y = nextDate.getFullYear();
        const m = nextDate.getMonth() + 1;
        const fy = m >= 4 ? y : y - 1;
        
        // We only populate if it's not too far in the past, or just populate everything up to max date
        const schedule = getScheduleForYear(ent, fy);
        const cell = schedule.find(c => c.month === m);
        
        if (cell && (cell.type === 'none' || (cell.type === 'visit' && cell.status === 'pending'))) {
          cell.type = 'audit';
          cell.status = 'pending';
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      cacheRef.current = newCache;
      setEnterprises(loadScheduleWithReports(fiscalYear, enterprises));
      setTimeout(() => syncToCloud(), 500);
      alert(`${updatedCount}件の「監査」を自動補完しました。`);
    } else {
      alert('自動補完できる対象がありませんでした（履歴がない、またはすべて登録済みです）。');
    }
  };

  const handleAutoFillVisits = () => {
    if (!confirm('実1入国日に基づいて、入国月から12ヶ月間の「訪問」スケジュールを自動補完しますか？\n（すでに登録されている予定は上書きされません）')) return;

    let updatedCount = 0;
    const newCache = { ...cacheRef.current };

    const getScheduleForYear = (ent: Enterprise, year: number) => {
      if (!newCache[year]) newCache[year] = {};
      if (!newCache[year][ent.id]) {
        newCache[year][ent.id] = calculateSchedule(ent, year);
      }
      return newCache[year][ent.id];
    };

    enterprises.forEach(ent => {
      if (!ent.entryDateJisshu1) return;
      const entryDate = new Date(ent.entryDateJisshu1);
      let y = entryDate.getFullYear();
      let m = entryDate.getMonth() + 1;

      for (let i = 0; i < 12; i++) {
        const fy = m >= 4 ? y : y - 1;
        const schedule = getScheduleForYear(ent, fy);
        const cell = schedule.find(c => c.month === m);
        
        if (cell && cell.type === 'none') {
          cell.type = 'visit';
          cell.status = 'pending';
          updatedCount++;
        }

        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    });

    if (updatedCount > 0) {
      cacheRef.current = newCache;
      setEnterprises(loadScheduleWithReports(fiscalYear, enterprises));
      setTimeout(() => syncToCloud(), 500);
      alert(`${updatedCount}件の「訪問」を自動補完しました。`);
    } else {
      alert('自動補完できる対象がありませんでした（すべて登録済みか、入国日が未設定です）。');
    }
  };

  const handleResetAllSchedules = async () => {
    const firstConfirm = confirm('⚠️ 警告！\n全企業の監査・訪問スケジュールと完了報告を削除します。\nこの操作は元に戻せません。\n本当に削除しますか？');
    if (!firstConfirm) return;
    const secondConfirm = confirm('もう一度確認。\n「はい」を押すと全データが永久履歬から削除されます。');
    if (!secondConfirm) return;

    // 1. Wipe cache
    cacheRef.current = {};

    // 2. Reset all enterprise schedules to blank
    const resetEnts = enterprises.map(ent => ({
      ...ent,
      schedule: MONTHS.map(m => ({ month: m, type: 'none' as TaskType, status: 'pending' as StatusType }))
    }));

    // 3. Clear localStorage
    try {
      localStorage.removeItem('sol_cache');
      localStorage.setItem('sol_enterprises', JSON.stringify(resetEnts.map(e => ({ ...e, schedule: [] }))));
    } catch { /* silent */ }

    setEnterprises(resetEnts);
    setTimeout(() => syncToCloud(resetEnts), 500);
    alert('スケジュール・完了報告を全て削除しました。');
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
    if (!selectedCell) return;
    if (!confirm('解除しますか？')) return;
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
      setTempReport(cell?.report ? { ...cell.report } : { ...emptyReport });
      setModalMode('checklist');
    }
  };

  const renderMobileMonthCell = (cell: ScheduleCell, ent: Enterprise) => {
    const isCurrent = cell.month === currentMonth;
    const isCompleted = cell.status === 'completed' && cell.report;
    const isAudit = cell.type === 'audit';
    
    let bg = 'transparent';
    let color = 'var(--text-muted)';
    let border = '1px dashed var(--card-border)';
    
    if (cell.type !== 'none') {
      bg = isAudit ? 'var(--status-yellow-bg)' : 'var(--primary-light)';
      color = isAudit ? 'var(--status-yellow)' : 'var(--primary)';
      border = `1px solid ${isAudit ? '#fde68a' : '#bfdbfe'}`;
    }
    
    if (isCompleted) {
      bg = 'var(--status-green-bg)';
      color = 'var(--status-green)';
      border = `1px solid var(--status-green)`;
    }

    return (
      <div 
        key={cell.month}
        className="month-box"
        onClick={() => openChecklist(ent, cell.month, cell.type)}
        style={{ 
          background: bg, 
          color: color, 
          border: border,
          position: 'relative',
          fontWeight: 'bold',
          boxShadow: isCurrent ? '0 0 0 2px var(--status-red)' : 'none',
          fontSize: '0.65rem'
        }}
      >
        <span style={{ fontSize: '0.55rem', opacity: isCompleted || cell.type !== 'none' ? 0.6 : 1, lineHeight: 1 }}>{cell.month}月</span>
        {cell.type !== 'none' && <span style={{ fontSize: '0.8rem', lineHeight: 1 }}>{isAudit ? '監' : '訪'}</span>}
        {isCompleted && cell.report && (
          <div style={{ fontSize: '0.5rem', fontWeight: 'normal', opacity: 0.8, lineHeight: 1 }}>
            {formatShortDate(cell.report.date)}
          </div>
        )}
      </div>
    );
  };

  const renderMobileView = () => (
    <div className="mobile-only" style={{ overflowY: 'auto', flex: 1, marginTop: '0.5rem' }}>
      {filteredEnterprises.map((ent, idx) => {
        const isFirstMatch = searchTerm && idx === 0;
        const isMatching = searchTerm && ent.name.toLowerCase().includes(searchTerm.toLowerCase());
        return (
          <div 
            key={ent.id} 
            ref={isFirstMatch ? scrollRef : null}
            className="enterprise-card" 
            style={{ 
              padding: '0.75rem', 
              marginBottom: '0.75rem',
              transition: 'all 0.5s ease',
              border: isMatching ? '2px solid var(--status-amber)' : '1px solid var(--card-border)',
              background: isMatching ? '#fffbeb' : 'white'
            }}
          >
            <div className="card-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }} onClick={() => { setTargetEnt(ent); setModalMode('edit'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: isMatching ? 'var(--status-amber)' : 'var(--primary)', fontSize: '0.9rem' }}>
                  {isMatching && '🎯 '}{ent.name}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ent.entryDateJisshu1 || '-'}</span>
              </div>
            </div>
            <div className="month-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
              {ent.schedule.map(cell => renderMobileMonthCell(cell, ent))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderCellContent = (cell: ScheduleCell, ent: Enterprise) => {
    const isCurrent = cell.month === currentMonth;
    if (cell.type === 'none') {
      return (
        <button
          onClick={() => openChecklist(ent, cell.month, cell.type)}
          style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#dadce0', fontSize: '0.7rem' }}
        >＋</button>
      );
    }
    const isCompleted = cell.status === 'completed' && cell.report;
    const isAudit = cell.type === 'audit';
    const badgeStyle = {
      width: '32px', height: '32px', borderRadius: '4px', display: 'flex', flexDirection: 'column' as const,
      justifyContent: 'center', alignItems: 'center', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 auto',
      cursor: 'pointer', border: '1px solid transparent'
    };
    if (isCompleted && cell.report) {
      return (
        <div onClick={() => openChecklist(ent, cell.month, cell.type)}
          style={{ ...badgeStyle, width: '100%', height: '100%', background: 'var(--status-green-bg)', color: 'var(--status-green)', border: '1px solid var(--status-green)' }}>
          <span style={{ fontSize: '0.8rem' }}>{isAudit ? '監' : '訪'}</span>
          {cell.report.date && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1 }}>{formatShortDate(cell.report.date)}</div>}
          {cell.report.staff && <div style={{ fontSize: '0.6rem', color: 'var(--text-main)', fontWeight: 'bold', lineHeight: 1, maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.report.staff}</div>}
        </div>
      );
    }
    return (
      <div onClick={() => openChecklist(ent, cell.month, cell.type)}
        style={{ ...badgeStyle, background: isAudit ? 'var(--status-yellow-bg)' : 'var(--primary-light)', color: isAudit ? 'var(--status-yellow)' : 'var(--primary)', border: `1px solid ${isAudit ? '#fde68a' : '#bfdbfe'}`, boxShadow: isCurrent ? '0 0 0 2px var(--status-red)' : 'none' }}>
        {isAudit ? '監' : '訪'}
      </div>
    );
  };

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

  const inputStyle = { width: '100%', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '4px', boxSizing: 'border-box' as const };

  const filteredEnterprises = enterprises.filter(ent => {
    const matchesSearch = ent.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (viewMode === 'training' || filterMode === 'all') return matchesSearch;
    const currentMonthData = ent.schedule.find(c => c.month === currentMonth);
    if (filterMode === 'audit') return matchesSearch && currentMonthData?.type === 'audit';
    if (filterMode === 'visit') return matchesSearch && currentMonthData?.type === 'visit';
    if (filterMode === 'pending') return matchesSearch && currentMonthData?.type !== 'none' && currentMonthData?.status === 'pending';
    return matchesSearch;
  });

  const getTrainingStatus = (dateStr?: string) => {
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

  const renderTrainingView = () => (
    <div className="table-container" style={{ flex: 1, overflow: 'auto', background: 'white', border: '1px solid var(--card-border)', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '850px' }}>
        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 30 }}>
          <tr>
            <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0', fontSize: '0.75rem' }}>No</th>
            <th className="sticky-col" style={{ textAlign: 'left', width: '180px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#f8fafc' }}>企業名</th>
            <th style={{ width: '120px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem' }}>責任者</th>
            <th style={{ width: '100px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem' }}>責任受講日</th>
            <th style={{ width: '120px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem' }}>指導員</th>
            <th style={{ width: '100px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem' }}>指導受講日</th>
            <th style={{ width: '120px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem' }}>生活員</th>
            <th style={{ width: '100px', borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem' }}>生活受講日</th>
          </tr>
        </thead>
        <tbody>
          {filteredEnterprises.map((ent, idx) => {
            const isFirstMatch = searchTerm && idx === 0;
            const isMatching = searchTerm && ent.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            const respStat = getTrainingStatus(ent.respDate);
            const instrStat = getTrainingStatus(ent.instrDate);
            const lifeStat = getTrainingStatus(ent.lifeDate);

            return (
              <tr key={ent.id} ref={isFirstMatch ? (scrollRef as React.RefObject<HTMLTableRowElement | null>) : null} style={{ borderBottom: '1px solid var(--card-border)', background: isMatching ? '#fffbeb' : 'inherit' }}>
                <td style={{ fontSize: '0.75rem', borderRight: '1px solid var(--card-border)', color: '#94a3b8' }}>{idx + 1}</td>
                <td className="sticky-col" onClick={() => { setTargetEnt(ent); setModalMode('edit'); }} style={{ textAlign: 'left', borderRight: '1px solid var(--card-border)', cursor: 'pointer', color: isMatching ? 'var(--status-amber)' : 'var(--primary)', fontWeight: 'bold', padding: '0.6rem 0.75rem', fontSize: '0.85rem', background: isMatching ? '#fffbeb' : 'white', position: 'sticky', left: 0, zIndex: 10 }}>{isMatching && '🎯 '}{ent.name}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', color: ent.respName ? 'inherit' : '#94a3b8' }}>{ent.respName || '-'}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.75rem' }}>
                  {ent.respDate ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
                    <span>{formatShortDate(ent.respDate)}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: respStat.bg, color: respStat.color, fontWeight: respStat.isWarning ? 'bold' : 'normal', border: `1px solid ${respStat.color}40` }}>{respStat.text}</span>
                  </div> : <span style={{ color: '#94a3b8' }}>-</span>}
                </td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', color: ent.instrName ? 'inherit' : '#94a3b8' }}>{ent.instrName || '-'}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.75rem' }}>
                  {ent.instrDate ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
                    <span>{formatShortDate(ent.instrDate)}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: instrStat.bg, color: instrStat.color, fontWeight: instrStat.isWarning ? 'bold' : 'normal', border: `1px solid ${instrStat.color}40` }}>{instrStat.text}</span>
                  </div> : <span style={{ color: '#94a3b8' }}>-</span>}
                </td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', color: ent.lifeName ? 'inherit' : '#94a3b8' }}>{ent.lifeName || '-'}</td>
                <td style={{ fontSize: '0.75rem' }}>
                  {ent.lifeDate ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
                    <span>{formatShortDate(ent.lifeDate)}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: lifeStat.bg, color: lifeStat.color, fontWeight: lifeStat.isWarning ? 'bold' : 'normal', border: `1px solid ${lifeStat.color}40` }}>{lifeStat.text}</span>
                  </div> : <span style={{ color: '#94a3b8' }}>-</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <form onSubmit={handleLogin} className="card card-modal" style={{ width: '380px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ソリューション協同組合</p>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', margin: 0 }}>監査訪問管理システム</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>パスワードを入力してください</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={inputStyle} autoFocus required />
            </div>
            {loginError && <p style={{ color: 'var(--status-red)', fontSize: '0.8rem', margin: 0 }}>パスワードが正しくありません。</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>アクセス</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <main className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '0.6rem' }}>
      <header style={{ flex: '0 0 auto', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <span style={{ fontSize: '1.4rem' }}>📋</span> SOL 監査・訪問管理
            <span style={{ 
              fontSize: '0.65rem', background: isSyncing ? '#fff7ed' : '#f0fdf4', color: isSyncing ? '#9a3412' : '#166534', 
              padding: '2px 8px', borderRadius: '12px', border: `1px solid ${isSyncing ? '#ffedd5' : '#dcfce7'}`, fontWeight: 'bold'
            }}>
              {isSyncing ? '🔄 同期中...' : '✅ 同期済み'}
            </span>
          </h1>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button className="btn" onClick={() => syncToCloud()} disabled={isSyncing} style={{ fontSize: '0.75rem', padding: '0.5rem 0.8rem', background: 'white', border: '1px solid var(--card-border)' }}>🔄 同期</button>
            <button className="btn btn-primary" onClick={() => { setTargetEnt({ id: '', name: '', countTokutei: 0, countJisshu23: 0, countJisshu1: 0, entryDateJisshu1: '', schedule: [] }); setModalMode('add'); }} style={{ fontSize: '0.75rem', padding: '0.5rem 0.8rem' }}>+ 企業登録</button>
            <button className="btn" onClick={() => { sessionStorage.removeItem('isLoggedIn'); window.location.reload(); }} style={{ fontSize: '0.75rem', padding: '0.5rem 0.8rem', background: '#f1f5f9', color: '#64748b' }}>ログアウト</button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ background: 'white', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '4px', display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <input type="text" placeholder="企業名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.8rem', borderRadius: '4px', border: '1px solid var(--card-border)', fontSize: '0.8rem' }} />
            <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem' }}>🔍</span>
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {viewMode === 'schedule' && [{id:'all',label:'すべて'},{id:'audit',label:'監査'},{id:'visit',label:'訪問'},{id:'pending',label:'未完'}].map(f => (
              <button key={f.id} onClick={() => setFilterMode(f.id as 'all' | 'audit' | 'visit' | 'pending')} style={{ padding: '0.3rem 0.6rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: '600', border: '1px solid', cursor: 'pointer', borderColor: filterMode === f.id ? 'var(--primary)' : 'var(--card-border)', background: filterMode === f.id ? 'var(--primary)' : 'white', color: filterMode === f.id ? 'white' : 'var(--text-main)' }}>{f.label}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>表示: <strong>{filteredEnterprises.length}</strong> / {enterprises.length} 社</div>
        </div>

        {/* Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.4rem', background: 'white', border: '1px solid var(--card-border)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#f1f3f4', padding: '2px', borderRadius: '4px' }}>
            <button onClick={() => changeFiscalYear(-1)} disabled={fiscalYear <= 2025} style={{ padding: '4px 8px', border: 'none', borderRadius: '3px', background: fiscalYear <= 2025 ? 'transparent' : 'white', cursor: fiscalYear <= 2025 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>◀ 前年</button>
            <div style={{ padding: '0 0.75rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>{fiscalYear}年度</div>
            <button onClick={() => changeFiscalYear(1)} style={{ padding: '4px 8px', border: 'none', borderRadius: '3px', background: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>翌年 ▶</button>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={handleAutoFillAudits} style={{ padding: '0.3rem 0.6rem', border: '1px solid #fde047', borderRadius: '3px', background: '#fefce8', color: '#a16207', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>⚙️</span> 監査を自動補完 (3ヶ月)
            </button>
            <button onClick={handleAutoFillVisits} style={{ padding: '0.3rem 0.6rem', border: '1px solid #c2e7ff', borderRadius: '3px', background: '#f1f8ff', color: '#0061c1', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>⚙️</span> 訪問を自動補完 (12ヶ月)
            </button>
            <button onClick={handleResetAllSchedules} style={{ padding: '0.3rem 0.6rem', border: '1px solid #fecaca', borderRadius: '3px', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>🗑️</span> 全履歴リセット
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button onClick={() => setViewMode('schedule')} style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--card-border)', background: viewMode === 'schedule' ? 'var(--primary)' : 'white', color: viewMode === 'schedule' ? 'white' : 'var(--text-main)', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>📅 スケジュール管理</button>
          <button onClick={() => setViewMode('training')} style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--card-border)', background: viewMode === 'training' ? 'var(--primary)' : 'white', color: viewMode === 'training' ? 'white' : 'var(--text-main)', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🎓 受講・責任者管理 (3年更新)</button>
        </div>
      </header>

      {viewMode === 'schedule' ? (
        <>
          {/* Main Table */}
      <div className="table-container desktop-only" style={{ flex: 1, overflow: 'auto', background: 'white', border: '1px solid var(--card-border)', borderRadius: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '1300px' }}>
          <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 30 }}>
            <tr>
              <th style={{ width: '30px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0', fontSize: '0.7rem' }}>No</th>
              <th className="sticky-col" style={{ textAlign: 'left', width: '160px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#f8fafc' }}>企業名</th>
              <th style={{ width: '60px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>特・実・育</th>
              <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>内1年目</th>
              <th style={{ width: '70px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>内1年目入国</th>
              {MONTHS.map(m => (
                <th key={m} style={{ borderRight: '1px solid var(--card-border)', width: '50px', borderBottom: m === currentMonth ? '2px solid var(--status-red)' : '1px solid var(--card-border)', background: m === currentMonth ? 'var(--status-red-bg)' : 'inherit', fontSize: '0.75rem' }}>{m}月</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEnterprises.map((ent, idx) => {
              const isFirstMatch = searchTerm && idx === 0;
              const isMatching = searchTerm && ent.name.toLowerCase().includes(searchTerm.toLowerCase());
              return (
                <tr key={ent.id} ref={isFirstMatch ? (scrollRef as React.RefObject<HTMLTableRowElement | null>) : null} style={{ borderBottom: '1px solid var(--card-border)', background: isMatching ? '#fffbeb' : 'inherit' }}>
                  <td style={{ fontSize: '0.7rem', borderRight: '1px solid var(--card-border)', color: '#94a3b8' }}>{idx + 1}</td>
                  <td className="sticky-col" onClick={() => { setTargetEnt(ent); setModalMode('edit'); }} style={{ textAlign: 'left', borderRight: '1px solid var(--card-border)', cursor: 'pointer', color: isMatching ? 'var(--status-amber)' : 'var(--primary)', fontWeight: 'bold', padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: isMatching ? '#fffbeb' : 'white', position: 'sticky', left: 0, zIndex: 10 }}>{isMatching && '🎯 '}{ent.name}</td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem' }}>{ent.countTokutei + ent.countJisshu23}</td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem' }}>{ent.countJisshu1}</td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.7rem' }}>{ent.entryDateJisshu1 || '-'}</td>
                  {ent.schedule.map((cell, sIdx) => (
                    <td key={sIdx} style={{ borderRight: '1px solid var(--card-border)', padding: '2px', background: cell.month === currentMonth ? '#fffafa' : 'inherit' }}>
                      {renderCellContent(cell, ent)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {renderMobileView()}
        </>
      ) : (
        renderTrainingView()
      )}

      {/* Modals */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="card card-modal" style={{ width: '400px' }}>
            <h3>{modalMode === 'add' ? '実習実施者の登録' : '実習実施者の編集'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>企業名</label>
                <input type="text" placeholder="企業名" value={targetEnt.name} onChange={e => setTargetEnt({...targetEnt, name: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>特・実・育</label>
                  <input type="number" placeholder="0" value={targetEnt.countTokutei + targetEnt.countJisshu23} onChange={e => setTargetEnt({...targetEnt, countTokutei: parseInt(e.target.value)||0, countJisshu23: 0})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>内1年目</label>
                  <input type="number" placeholder="0" value={targetEnt.countJisshu1} onChange={e => setTargetEnt({...targetEnt, countJisshu1: parseInt(e.target.value)||0})} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>内1年目入国日</label>
                <input type="date" value={targetEnt.entryDateJisshu1} onChange={e => setTargetEnt({...targetEnt, entryDateJisshu1: e.target.value})} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>責任者</label>
                  <input type="text" placeholder="氏名" value={targetEnt.respName || ''} onChange={e => setTargetEnt({...targetEnt, respName: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>責任受講日</label>
                  <input type="date" value={targetEnt.respDate || ''} onChange={e => setTargetEnt({...targetEnt, respDate: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>指導員</label>
                  <input type="text" placeholder="氏名" value={targetEnt.instrName || ''} onChange={e => setTargetEnt({...targetEnt, instrName: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>指導受講日</label>
                  <input type="date" value={targetEnt.instrDate || ''} onChange={e => setTargetEnt({...targetEnt, instrDate: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>生活員</label>
                  <input type="text" placeholder="氏名" value={targetEnt.lifeName || ''} onChange={e => setTargetEnt({...targetEnt, lifeName: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>生活受講日</label>
                  <input type="date" value={targetEnt.lifeDate || ''} onChange={e => setTargetEnt({...targetEnt, lifeDate: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setModalMode('none')}>キャンセル</button>
                {modalMode === 'edit' && (
                  <button className="btn" style={{ background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => handleDeleteEnterprise(targetEnt)}>🗑️ 削除</button>
                )}
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEnterprise}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'checklist' && selectedCell && (() => {
        const entName = enterprises.find(e => e.id === selectedCell.entId)?.name || '';
        const isAudit = selectedCell.type === 'audit';
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
            <div className="card card-modal" style={{ width: '480px', maxHeight: '92vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
                <span>📝 {entName} — {selectedCell.month}月 報告書入力</span>
                <button onClick={() => setModalMode('none')} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', padding: '0 5px' }}>×</button>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* ── 監査セクション (監査月のみ表示) ── */}
                {isAudit && (
                  <div style={{ background: 'var(--status-yellow-bg)', padding: '0.75rem', borderRadius: '4px', border: '1px solid #fde68a' }}>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--status-yellow)', margin: '0 0 0.75rem 0', fontWeight: 'bold' }}>【監査】</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>担当者</label>
                        <input type="text" value={tempReport.staff} onChange={e => setTempReport({ ...tempReport, staff: e.target.value })} style={inputStyle} autoComplete="off" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>実施日</label>
                        <input type="date" value={tempReport.date} onChange={e => setTempReport({ ...tempReport, date: e.target.value })} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>面談者</label>
                      <input type="text" value={tempReport.interviewee} onChange={e => setTempReport({ ...tempReport, interviewee: e.target.value })} style={inputStyle} />
                    </div>

                    {/* Checklist */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { key: 'checkSalary', label: '給料明細' },
                        { key: 'checkLog', label: '実習日誌' },
                      ].map(({ key, label }) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{label}</span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {(['ok', 'ng'] as const).map(v => (
                              <button
                                key={v}
                                onClick={() => setTempReport({ ...tempReport, [key]: v })}
                                style={{
                                  padding: '2px 10px', fontSize: '0.7rem',
                                  border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer',
                                  background: tempReport[key as keyof Report] === v ? (v === 'ok' ? 'var(--status-green)' : 'var(--status-red)') : 'white',
                                  color: tempReport[key as keyof Report] === v ? 'white' : 'inherit',
                                  fontWeight: 'bold'
                                }}
                              >
                                {v === 'ok' ? '適正' : '不備'}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 訪問指導セクション (常に表示) ── */}
                <div style={{ background: 'var(--primary-light)', padding: '0.75rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: '0 0 0.75rem 0', fontWeight: 'bold' }}>
                    {isAudit ? '【訪問指導】' : '訪問指導 内容'}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>担当者</label>
                      <input
                        type="text"
                        value={isAudit ? (tempReport.vStaff || '') : tempReport.staff}
                        onChange={e => isAudit
                          ? setTempReport({ ...tempReport, vStaff: e.target.value })
                          : setTempReport({ ...tempReport, staff: e.target.value })}
                        style={inputStyle} autoComplete="off"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>実施日</label>
                      <input
                        type="date"
                        value={isAudit ? (tempReport.vDate || '') : tempReport.date}
                        onChange={e => isAudit
                          ? setTempReport({ ...tempReport, vDate: e.target.value })
                          : setTempReport({ ...tempReport, date: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>面談者</label>
                    <input
                      type="text"
                      value={isAudit ? (tempReport.vInterviewee || '') : tempReport.interviewee}
                      onChange={e => isAudit
                        ? setTempReport({ ...tempReport, vInterviewee: e.target.value })
                        : setTempReport({ ...tempReport, interviewee: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* ── 備考 ── */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>備考欄</label>
                  <textarea
                    value={tempReport.remarks || ''}
                    onChange={e => setTempReport({ ...tempReport, remarks: e.target.value })}
                    style={{ ...inputStyle, height: '60px', resize: 'none' }}
                    placeholder="特記事項があれば入力してください"
                  />
                </div>
              </div>

              {/* ── ボタン行 ── */}
              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleRemoveSchedule}
                  style={{ flex: '0 0 auto', padding: '0.6rem 0.9rem', border: '1px solid var(--status-red)', borderRadius: '4px', background: 'white', color: 'var(--status-red)', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  スケジュール解除
                </button>
                <button className="btn btn-primary" onClick={handleSaveReport} style={{ flex: 1, padding: '0.6rem' }}>
                  保存
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {modalMode === 'settype' && selectedCell && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div className="card card-modal" style={{ width: '300px', textAlign: 'center' }}>
            <h3>{selectedCell.month}月 種類設定</h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleSetType('visit')}>訪問</button>
              <button className="btn" style={{ flex: 1, background: 'var(--status-yellow)', color: 'white' }} onClick={() => handleSetType('audit')}>監査</button>
            </div>
            <button className="btn" onClick={() => setModalMode('none')}>キャンセル</button>
          </div>
        </div>
      )}
    </main>
  );
}
