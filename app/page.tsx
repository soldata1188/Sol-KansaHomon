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
  schedule: ScheduleCell[];
}

const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

// --- Utilities ---
const getFiscalMonths = (year: number) => {
  return MONTHS.map(m => ({
    month: m,
    year: m >= 4 ? year : year + 1
  }));
};

const formatShortDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
};

// --- Logic: Automated Scheduling ---
const calculateSchedule = (ent: Enterprise, fiscalYear: number): ScheduleCell[] => {
  const schedule: ScheduleCell[] = MONTHS.map(m => ({ month: m, type: 'none', status: 'pending' }));
  if (!ent.entryDateJisshu1) return schedule;

  const entryDate = new Date(ent.entryDateJisshu1);
  const entryMonth = entryDate.getMonth() + 1;
  const entryYear = entryDate.getFullYear();

  MONTHS.forEach(m => {
    const targetYear = m >= 4 ? fiscalYear : fiscalYear + 1;
    const targetDate = new Date(targetYear, m - 1, 1);
    
    // 1. Visit every month (Default)
    let type: TaskType = 'visit';

    // 2. Audit every 3 months starting from entry month
    const monthsSinceEntry = (targetYear * 12 + m) - (entryYear * 12 + entryMonth);
    if (monthsSinceEntry >= 0 && monthsSinceEntry % 3 === 0) {
      type = 'audit';
    }

    const cell = schedule.find(c => c.month === m);
    if (cell) cell.type = type;
  });

  return schedule;
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
  const scrollRef = useRef<HTMLDivElement | HTMLTableRowElement | null>(null);

  const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwoaB1_RZ0nheTgUNptjVz-Cv6ysusph7C_LKl3HYC2__3EygtnIrdzxAXiatXCnI0jwg/exec';

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
    const safeSetLocal = (key: string, value: string) => {
      try { localStorage.setItem(key, value); } catch { /* silent */ }
    };

    const auth = safeGetSession('isLoggedIn');
    if (auth === 'true') setIsAuthenticated(true);

    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    const currentFY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    setFiscalYear(currentFY);

    const loadData = async () => {
      setIsSyncing(true);
      let cloudEnts: Enterprise[] = [];
      let cloudCache: Record<string, any> = {};

      // Step 1: Try to fetch from Cloud (non-fatal if fails)
      try {
        const response = await fetch(GOOGLE_SHEETS_URL);
        if (response.ok) {
          const cloudData = await response.json();
          cloudEnts = cloudData?.enterprises || [];
          cloudCache = cloudData?.cache || {};
        }
      } catch (e) {
        console.warn('クラウドからの読み込みに失敗しました（ローカルを使用します）:', e);
      }

      // Step 2: Try to read from LocalStorage (non-fatal if fails)
      let localEnts: Enterprise[] = [];
      let localCache: Record<string, any> = {};
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

    const timeoutId = setTimeout(() => syncToCloud(), 5000);
    return () => clearTimeout(timeoutId);
  }, [enterprises, isAuthenticated, isInitialLoadDone]);

  const syncToCloud = async () => {
    if (enterprises.length === 0) return;
    setIsSyncing(true);
    console.log('🔄 同期を開始します...', { count: enterprises.length });

    try {
      // Thêm timestamp để kiểm soát phiên bản gửi
      const payload = {
        timestamp: new Date().toISOString(),
        enterprises,
        cache: cacheRef.current
      };

      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('✅ 送信完了 (GAS側で処理中)');
    } catch (e) {
      console.error('❌ 同期エラー:', e);
    } finally {
      // Giả lập thời gian chờ để GAS kịp xử lý
      setTimeout(() => setIsSyncing(false), 1500);
    }
  };

  const loadScheduleWithReports = (year: number, ents: Enterprise[]): Enterprise[] => {
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
    if (!targetEnt.name) return;
    setEnterprises(prev => {
      let next;
      if (!targetEnt.id) {
        const fullNewEnt = { ...targetEnt, id: 'ENT' + Date.now(), schedule: calculateSchedule(targetEnt, fiscalYear) };
        next = [...prev, fullNewEnt];
      } else {
        next = prev.map(e => (e.id === targetEnt.id ? { ...e, ...targetEnt, schedule: calculateSchedule(targetEnt, fiscalYear) } : e));
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
      return updated;
    });
    setModalMode('none');
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Solution422@') {
      setIsAuthenticated(true);
      try { sessionStorage.setItem('isLoggedIn', 'true'); } catch { /* silent */ }
      setLoginError(false);
    } else setLoginError(true);
  };

  const inputStyle = { width: '100%', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '4px', boxSizing: 'border-box' as const };

  const filteredEnterprises = enterprises.filter(ent => {
    const matchesSearch = ent.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterMode === 'all') return matchesSearch;
    const currentMonthData = ent.schedule.find(c => c.month === currentMonth);
    if (filterMode === 'audit') return matchesSearch && currentMonthData?.type === 'audit';
    if (filterMode === 'visit') return matchesSearch && currentMonthData?.type === 'visit';
    if (filterMode === 'pending') return matchesSearch && currentMonthData?.type !== 'none' && currentMonthData?.status === 'pending';
    return matchesSearch;
  });

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
            <button className="btn" onClick={syncToCloud} disabled={isSyncing} style={{ fontSize: '0.75rem', padding: '0.5rem 0.8rem', background: 'white', border: '1px solid var(--card-border)' }}>🔄 同期</button>
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
            {[{id:'all',label:'すべて'},{id:'audit',label:'監査'},{id:'visit',label:'訪問'},{id:'pending',label:'未完'}].map(f => (
              <button key={f.id} onClick={() => setFilterMode(f.id as any)} style={{ padding: '0.3rem 0.6rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: '600', border: '1px solid', cursor: 'pointer', borderColor: filterMode === f.id ? 'var(--primary)' : 'var(--card-border)', background: filterMode === f.id ? 'var(--primary)' : 'white', color: filterMode === f.id ? 'white' : 'var(--text-main)' }}>{f.label}</button>
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
          <button onClick={() => { if(confirm('自動補完しますか？')) { /* Logic */ } }} style={{ padding: '0.3rem 0.6rem', border: '1px solid #c2e7ff', borderRadius: '3px', background: '#f1f8ff', color: '#0061c1', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>⚙ 自動補完</button>
        </div>
      </header>

      {/* Main Table */}
      <div className="table-container desktop-only" style={{ flex: 1, overflow: 'auto', background: 'white', border: '1px solid var(--card-border)', borderRadius: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '1300px' }}>
          <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 30 }}>
            <tr>
              <th style={{ width: '30px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0', fontSize: '0.7rem' }}>No</th>
              <th className="sticky-col" style={{ textAlign: 'left', width: '160px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#f8fafc' }}>企業名</th>
              <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>特定</th>
              <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>実2・3</th>
              <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>実1</th>
              <th style={{ width: '70px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>実1入国</th>
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
                <tr key={ent.id} ref={isFirstMatch ? (scrollRef as any) : null} style={{ borderBottom: '1px solid var(--card-border)', background: isMatching ? '#fffbeb' : 'inherit' }}>
                  <td style={{ fontSize: '0.7rem', borderRight: '1px solid var(--card-border)', color: '#94a3b8' }}>{idx + 1}</td>
                  <td className="sticky-col" style={{ textAlign: 'left', borderRight: '1px solid var(--card-border)', cursor: 'pointer', color: isMatching ? 'var(--status-amber)' : 'var(--primary)', fontWeight: 'bold', padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: isMatching ? '#fffbeb' : 'white', position: 'sticky', left: 0, zIndex: 10 }}>{isMatching && '🎯 '}{ent.name}</td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem' }}>{ent.countTokutei}</td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem' }}>{ent.countJisshu23}</td>
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

      {/* Modals */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="card card-modal" style={{ width: '400px' }}>
            <h3>{modalMode === 'add' ? '実習実施者の登録' : '実習実施者の編集'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input type="text" placeholder="企業名" value={targetEnt.name} onChange={e => setTargetEnt({...targetEnt, name: e.target.value})} style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <input type="number" placeholder="特定" value={targetEnt.countTokutei} onChange={e => setTargetEnt({...targetEnt, countTokutei: parseInt(e.target.value)||0})} style={inputStyle} />
                <input type="number" placeholder="実23" value={targetEnt.countJisshu23} onChange={e => setTargetEnt({...targetEnt, countJisshu23: parseInt(e.target.value)||0})} style={inputStyle} />
                <input type="number" placeholder="実1" value={targetEnt.countJisshu1} onChange={e => setTargetEnt({...targetEnt, countJisshu1: parseInt(e.target.value)||0})} style={inputStyle} />
              </div>
              <input type="date" value={targetEnt.entryDateJisshu1} onChange={e => setTargetEnt({...targetEnt, entryDateJisshu1: e.target.value})} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setModalMode('none')}>キャンセル</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEnterprise}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'checklist' && selectedCell && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div className="card card-modal" style={{ width: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{selectedCell.month}月 報告書入力</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="担当者" value={tempReport.staff} onChange={e => setTempReport({...tempReport, staff: e.target.value})} style={inputStyle} />
              <input type="date" value={tempReport.date} onChange={e => setTempReport({...tempReport, date: e.target.value})} style={inputStyle} />
              <textarea placeholder="備考" value={tempReport.remarks} onChange={e => setTempReport({...tempReport, remarks: e.target.value})} style={{...inputStyle, height: '80px'}} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" onClick={handleRemoveSchedule} style={{ color: 'var(--status-red)' }}>削除</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveReport}>保存</button>
                <button className="btn" onClick={() => setModalMode('none')}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
