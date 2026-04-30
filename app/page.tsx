'use client';

import React, { useState, useEffect } from 'react';

type TaskType = 'visit' | 'audit' | 'none';
type StatusType = 'pending' | 'completed' | 'overdue';

interface ReportData {
  staff: string;
  date: string;
  interviewee: string;
  // Fields for visit part within an audit month
  vStaff?: string;
  vDate?: string;
  vInterviewee?: string;
  remarks: string;
  checkSalary: 'ok' | 'ng' | null;
  checkLog: 'ok' | 'ng' | null;
}

interface ScheduleCell {
  month: number;
  year: number;
  type: TaskType;
  status: StatusType;
  report?: ReportData;
}

interface Enterprise {
  id: string;
  name: string;
  countTokutei: number;
  countJisshu23: number;
  countJisshu1: number;
  entryDateJisshu1: string;
  schedule: ScheduleCell[];
}

const getFiscalMonths = (fy: number) => [
  { m: 4, y: fy }, { m: 5, y: fy }, { m: 6, y: fy },
  { m: 7, y: fy }, { m: 8, y: fy }, { m: 9, y: fy },
  { m: 10, y: fy }, { m: 11, y: fy }, { m: 12, y: fy },
  { m: 1, y: fy + 1 }, { m: 2, y: fy + 1 }, { m: 3, y: fy + 1 }
];

const calculateSchedule = (ent: Omit<Enterprise, 'schedule' | 'id'>, fy: number): ScheduleCell[] => {
  const entryDateStr = ent.entryDateJisshu1.replace(/\//g, '-');
  const entryDate = ent.entryDateJisshu1 ? new Date(entryDateStr) : null;

  return getFiscalMonths(fy).map(({ m, y }) => {
    const currentPeriod = new Date(y, m - 1);
    let type: TaskType = 'none';

    // AUTO-GENERATE VISITS (訪問) FOR ALL 12 MONTHS OF JISSHU 1
    if (ent.countJisshu1 > 0 && entryDate) {
      const entryMonth = entryDate.getMonth() + 1;
      const entryYear = entryDate.getFullYear();
      
      // Calculate the 12-month window starting from the entry month
      const startPeriod = new Date(entryYear, entryMonth - 1);
      const endPeriod = new Date(entryYear, entryMonth - 1 + 11);
      
      if (currentPeriod >= startPeriod && currentPeriod <= endPeriod) {
        type = 'visit';
      }
    }

    return { month: m, year: y, type, status: 'pending' as StatusType };
  });
};

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
};

export default function AnnualScheduleMatrix() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'checklist' | 'settype' | 'none'>('none');
  const [selectedCell, setSelectedCell] = useState<{ entId: string; month: number; type: TaskType } | null>(null);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [targetEnt, setTargetEnt] = useState<Omit<Enterprise, 'schedule'>>({ id: '', name: '', countTokutei: 0, countJisshu23: 0, countJisshu1: 0, entryDateJisshu1: '' });
  const [currentMonth, setCurrentMonth] = useState(0);
  const [fiscalYear, setFiscalYear] = useState(2026);
  const emptyReport: ReportData = { staff: '', date: '', interviewee: '', vStaff: '', vDate: '', vInterviewee: '', remarks: '', checkSalary: null, checkLog: null };
  const [tempReport, setTempReport] = useState<ReportData>({ ...emptyReport });
  // キャッシュ: { [fiscalYear]: { [enterpriseId]: ScheduleCell[] } }
  const cacheRef = React.useRef<Record<number, Record<string, ScheduleCell[]>>>({});

  const saveCurrentToCache = (fy: number, ents: Enterprise[]) => {
    const yearCache: Record<string, ScheduleCell[]> = {};
    ents.forEach(ent => { yearCache[ent.id] = ent.schedule; });
    cacheRef.current[fy] = yearCache;
  };

  const loadScheduleWithReports = (fy: number, ents: Enterprise[]): Enterprise[] => {
    const cached = cacheRef.current[fy];
    return ents.map(ent => {
      // ロジックに基づいた最新のスケジュールを算出
      const freshSchedule = calculateSchedule(ent, fy);
      // キャッシュに報告書があればマージ
      if (cached?.[ent.id]) {
        const cachedCells = cached[ent.id];
        freshSchedule.forEach(cell => {
          const cachedCell = cachedCells.find(c => c.month === cell.month);
          if (cachedCell) {
            // Preserve manual type/status changes even without a report
            if (cachedCell.type !== 'none') {
              cell.type = cachedCell.type;
              cell.status = cachedCell.status;
            }
            if (cachedCell.report) {
              cell.report = cachedCell.report;
              cell.status = cachedCell.status;
            }
          }
        });
      }
      return { ...ent, schedule: freshSchedule };
    });
  };

  const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwoaB1_RZ0nheTgUNptjVz-Cv6ysusph7C_LKl3HYC2__3EygtnIrdzxAXiatXCnI0jwg/exec';
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'audit' | 'visit' | 'pending'>('all');
  const scrollRef = useRef<HTMLTableRowElement | null>(null);

  // --- Smart Search Scroll Effect ---
  useEffect(() => {
    if (searchTerm && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchTerm]);

  useEffect(() => {
    const auth = sessionStorage.getItem('isLoggedIn');
    if (auth === 'true') setIsAuthenticated(true);

    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    const currentFY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    setFiscalYear(currentFY);

    // Initial Load: Try Cloud first, then Local
    const loadData = async () => {
      setIsSyncing(true);
      try {
        const response = await fetch(GOOGLE_SHEETS_URL);
        const cloudData = await response.json();
        const cloudEnts = cloudData?.enterprises || [];
        const cloudCache = cloudData?.cache || {};

        const savedEntsRaw = localStorage.getItem('sol_enterprises');
        const savedCacheRaw = localStorage.getItem('sol_cache');
        const localEnts = savedEntsRaw ? JSON.parse(savedEntsRaw) : [];
        const localCache = savedCacheRaw ? JSON.parse(savedCacheRaw) : {};

        const mergedEntsMap = new Map();
        cloudEnts.forEach((ent: Enterprise) => mergedEntsMap.set(ent.id, ent));
        localEnts.forEach((le: Enterprise) => {
          if (!mergedEntsMap.has(le.id)) {
            mergedEntsMap.set(le.id, le);
            console.log('LocalStorageからデータを復元しました:', le.name);
          }
        });
        const mergedEnts = Array.from(mergedEntsMap.values());

        const mergedCache = { ...cloudCache };
        Object.keys(localCache).forEach(year => {
          if (!mergedCache[year]) {
            mergedCache[year] = localCache[year];
          } else {
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
        console.error('Data load failed', e);
        const savedEnts = localStorage.getItem('sol_enterprises');
        if (savedEnts) setEnterprises(loadScheduleWithReports(currentFY, JSON.parse(savedEnts)));
      } finally {
        setIsSyncing(false);
        setIsInitialLoadDone(true);
      }
    };

    loadData();
  }, []);

  // Sync to Cloud & LocalStorage
  useEffect(() => {
    if (!isAuthenticated || !isInitialLoadDone || enterprises.length === 0) return;
    
    // CRITICAL FIX: Save current year to cache BEFORE persisting
    const yearCache: Record<string, ScheduleCell[]> = {};
    enterprises.forEach(ent => { yearCache[ent.id] = ent.schedule; });
    cacheRef.current[fiscalYear] = yearCache;

    localStorage.setItem('sol_enterprises', JSON.stringify(enterprises));
    localStorage.setItem('sol_cache', JSON.stringify(cacheRef.current));

    const syncToCloud = async () => {
      if (enterprises.length === 0) return;
      setIsSyncing(true);
      try {
        // Prepare data package
        const payload = {
          action: 'SAVE',
          data: { enterprises, cache: cacheRef.current }
        };

        await fetch(GOOGLE_SHEETS_URL, {
          method: 'POST',
          mode: 'no-cors', // GAS requires no-cors for simple web app posts from browser
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        console.log('クラウドに同期データを送信しました');
      } catch (e) {
        console.error('同期に失敗しました', e);
      } finally {
        // Since no-cors doesn't provide a response, we wait a bit to show "Complete"
        setTimeout(() => setIsSyncing(false), 800);
      }
    };

    const timer = setTimeout(syncToCloud, 1500); // Debounce sync
    return () => clearTimeout(timer);
  }, [enterprises, isAuthenticated, isInitialLoadDone]);

  const changeFiscalYear = (delta: number) => {
    const newFY = fiscalYear + delta;
    if (newFY < 2025) return; // 2025年度未満への遷移を制限
    
    // 現在年度のデータをキャッシュに保存
    saveCurrentToCache(fiscalYear, enterprises);
    // 新年度のデータをロード（キャッシュ優先、なければ新規計算）
    const updated = loadScheduleWithReports(newFY, enterprises);
    setFiscalYear(newFY);
    setEnterprises(updated);
  };

  const handleAutoGenerate = () => {
    if (!confirm('空いている枠にのみ、スケジュールを自動計算で補完しますか？（入力済みのデータは保護されます）')) return;
    
    setEnterprises(prev => {
      const updated = prev.map(ent => {
        // ロジックに基づいた最新のスケジュールを算出
        const freshSchedule = calculateSchedule(ent, fiscalYear);
        
        // 既存データ（手動入力済みまたは報告書あり）を保護しつつマージ
        const mergedSchedule = ent.schedule.map(currentCell => {
          if (currentCell.type !== 'none' || currentCell.report) {
            return currentCell;
          }
          const autoCell = freshSchedule.find(c => c.month === currentCell.month);
          return autoCell ? { ...autoCell } : currentCell;
        });

        return { ...ent, schedule: mergedSchedule };
      });
      saveCurrentToCache(fiscalYear, updated);
      return updated;
    });
  };

  const handleSaveEnterprise = () => {
    if (!targetEnt.name) return;
    setEnterprises(prev => {
      let next;
      if (modalMode === 'add') {
        const newEnt: Enterprise = { ...targetEnt, id: `ENT${Date.now()}`, schedule: calculateSchedule(targetEnt, fiscalYear) };
        next = [...prev, newEnt];
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
        return { ...ent, schedule: ent.schedule.map(c => c.month === selectedCell.month ? { ...c, status: 'completed' as StatusType, report: { ...tempReport } } : c) };
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
    if (!confirm('このスケジュールの設定を解除してもよろしいですか？（入力済みの報告書も削除されます）')) return;
    
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
    if (type === 'none') {
      setModalMode('settype');
    } else {
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
          <>
            {cell.report.date && <div style={{ fontSize: '0.5rem', fontWeight: 'normal', opacity: 0.8, lineHeight: 1 }}>{formatShortDate(cell.report.date)}</div>}
            {cell.report.staff && <div style={{ fontSize: '0.5rem', fontWeight: 'bold', maxWidth: '36px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>{cell.report.staff}</div>}
          </>
        )}
      </div>
    );
  };

  const renderMobileView = () => (
    <div className="mobile-only" style={{ overflowY: 'auto', flex: 1, marginTop: '0.5rem' }}>
      {enterprises.map(ent => (
        <div key={ent.id} className="enterprise-card" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="card-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.4rem' }} onClick={() => { setTargetEnt(ent); setModalMode('edit'); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--primary)' }}>{ent.name}</h3>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>編集〉</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.72rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>特定:<strong>{ent.countTokutei}</strong></span>
              <span>実2-3:<strong>{ent.countJisshu23}</strong></span>
              <span>実1:<strong>{ent.countJisshu1}</strong></span>
              {ent.countJisshu1 > 0 && ent.entryDateJisshu1 && (
                <>
                  <span style={{ color: '#dadce0' }}>|</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>入国:{ent.entryDateJisshu1}</span>
                </>
              )}
            </div>
          </div>
          <div className="months-grid" style={{ gap: '0.35rem' }}>
            {ent.schedule.map(cell => renderMobileMonthCell(cell, ent))}
          </div>
        </div>
      ))}
    </div>
  );

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
              boxShadow: isMatching ? '0 0 15px rgba(217, 119, 6, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
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

    // REFINED BADGE STYLE
    const badgeStyle = {
      width: '32px',
      height: '32px',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '0.85rem',
      fontWeight: 'bold',
      margin: '0 auto',
      cursor: 'pointer',
      border: '1px solid transparent'
    };

    if (isCompleted && cell.report) {
      return (
        <div 
          onClick={() => openChecklist(ent, cell.month, cell.type)}
          style={{ 
            ...badgeStyle, 
            width: '100%', 
            height: '100%', 
            background: 'var(--status-green-bg)', 
            color: 'var(--status-green)', 
            border: '1px solid var(--status-green)',
            gap: '0px',
            padding: '2px 0'
          }}
        >
          <span style={{ fontSize: '0.8rem' }}>{isAudit ? '監' : '訪'}</span>
          {cell.report.date && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1 }}>{formatShortDate(cell.report.date)}</div>}
          {cell.report.staff && <div style={{ fontSize: '0.6rem', color: 'var(--text-main)', fontWeight: 'bold', lineHeight: 1, maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.report.staff}</div>}
        </div>
      );
    }

    return (
      <div 
        onClick={() => openChecklist(ent, cell.month, cell.type)}
        style={{ 
          ...badgeStyle, 
          background: isAudit ? 'var(--status-yellow-bg)' : 'var(--primary-light)', 
          color: isAudit ? 'var(--status-yellow)' : 'var(--primary)',
          border: `1px solid ${isAudit ? '#fde68a' : '#bfdbfe'}`,
          boxShadow: isCurrent ? '0 0 0 2px var(--status-red)' : 'none'
        }}
      >
        {isAudit ? '監' : '訪'}
      </div>
    );
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // 修正されたパスワードチェック
    if (password === 'Solution422@') {
      setIsAuthenticated(true);
      sessionStorage.setItem('isLoggedIn', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isLoggedIn');
    setPassword('');
  };

  const inputStyle = { width: '100%', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '4px', boxSizing: 'border-box' as const };

  // --- Filtering Logic ---
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
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password"
                style={inputStyle}
                autoFocus
                required
              />
            </div>
            
            {loginError && (
              <p style={{ color: 'var(--status-red)', fontSize: '0.8rem', margin: 0 }}>パスワードが正しくありません。</p>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>
              アクセス
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <main style={{ padding: '0.6rem', height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* COMPACT HEADER */}
      <header style={{ marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.1rem', color: 'var(--primary)', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>年間監査・訪問スケジュール</h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#bdc1c6' }}>SOL COOP.</span>
            {isSyncing ? (
              <span style={{ fontSize: '0.65rem', color: 'var(--primary)', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
                同期中...
              </span>
            ) : isInitialLoadDone && (
              <span style={{ fontSize: '0.65rem', color: 'var(--status-green)', marginLeft: '0.5rem', opacity: 0.8 }}>● クラウド同期済み</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button 
              className="btn btn-primary desktop-only" 
              onClick={() => { setTargetEnt({ id: '', name: '', countTokutei: 0, countJisshu23: 0, countJisshu1: 0, entryDateJisshu1: '' }); setModalMode('add'); }} 
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
            >
              ＋ 追加
            </button>
          </div>
        </div>

        {/* --- Smart Search & Filter Bar --- */}
        <div style={{ 
          background: 'white', 
          padding: '0.75rem', 
          border: '1px solid var(--card-border)',
          borderRadius: '4px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '0.6rem'
        }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <input 
              type="text" 
              placeholder="企業名で検索..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.4rem 0.5rem 0.4rem 1.8rem', 
                borderRadius: '4px', 
                border: '1px solid var(--card-border)',
                fontSize: '0.8rem'
              }}
            />
            <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem' }}>🔍</span>
          </div>

          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[
              { id: 'all', label: 'すべて' },
              { id: 'audit', label: '監査' },
              { id: 'visit', label: '訪問' },
              { id: 'pending', label: '未完' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id as any)}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '3px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  border: '1px solid',
                  cursor: 'pointer',
                  borderColor: filterMode === f.id ? 'var(--primary)' : 'var(--card-border)',
                  background: filterMode === f.id ? 'var(--primary)' : 'white',
                  color: filterMode === f.id ? 'white' : 'var(--text-main)'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            表示: <strong>{filteredEnterprises.length}</strong> / {enterprises.length} 社
          </div>
        </div>

        {/* COMPACT NAVIGATION BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.4rem', background: 'white', border: '1px solid var(--card-border)', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#f1f3f4', padding: '2px', borderRadius: '4px' }}>
            <button onClick={() => changeFiscalYear(-1)} disabled={fiscalYear <= 2025} style={{ padding: '4px 8px', border: 'none', borderRadius: '3px', background: fiscalYear <= 2025 ? 'transparent' : 'white', cursor: fiscalYear <= 2025 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: fiscalYear <= 2025 ? '#bdc1c6' : 'var(--text-main)' }}>◀ 前年</button>
            <div style={{ padding: '0 0.75rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>{fiscalYear}年度</div>
            <button onClick={() => changeFiscalYear(1)} style={{ padding: '4px 8px', border: 'none', borderRadius: '3px', background: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>翌年 ▶</button>
          </div>
          <button onClick={handleAutoGenerate} style={{ padding: '0.3rem 0.6rem', border: '1px solid #c2e7ff', borderRadius: '3px', background: '#f1f8ff', color: '#0061c1', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>⚙ 自動補完</button>
        </div>
      </header>

      {/* FORM MODAL */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="card card-modal" style={{ width: '450px' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>{modalMode === 'add' ? '実習実施者の登録' : '実習実施者の編集'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.875rem' }}>企業名</label><input type="text" value={targetEnt.name} onChange={e => setTargetEnt({ ...targetEnt, name: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div><label style={{ display: 'block', fontSize: '0.75rem' }}>特定</label><input type="number" value={targetEnt.countTokutei} onChange={e => setTargetEnt({ ...targetEnt, countTokutei: parseInt(e.target.value) || 0 })} style={inputStyle} /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem' }}>実2・3</label><input type="number" value={targetEnt.countJisshu23} onChange={e => setTargetEnt({ ...targetEnt, countJisshu23: parseInt(e.target.value) || 0 })} style={inputStyle} /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem' }}>実1</label><input type="number" value={targetEnt.countJisshu1} onChange={e => setTargetEnt({ ...targetEnt, countJisshu1: parseInt(e.target.value) || 0 })} style={inputStyle} /></div>
              </div>
              <div><label style={{ display: 'block', fontSize: '0.875rem' }}>実1 入国日</label><input type="date" value={targetEnt.entryDateJisshu1} onChange={e => setTargetEnt({ ...targetEnt, entryDateJisshu1: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" style={{ flex: 1, background: '#f1f3f4' }} onClick={() => setModalMode('none')}>キャンセル</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEnterprise}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKLIST MODAL */}
      {modalMode === 'checklist' && selectedCell && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div className="card card-modal" style={{ width: '500px', display: 'flex', flexDirection: 'column', maxHeight: '95vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{targetEnt?.name} - {selectedCell.month}月 {selectedCell.type === 'audit' ? '監査・訪問' : '訪問指導'}</span>
              <button onClick={() => setModalMode('none')} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', padding: '0 5px' }}>×</button>
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* AUDIT SECTION (Only for Audit type) */}
              {selectedCell.type === 'audit' && (
                <div style={{ background: 'var(--status-yellow-bg)', padding: '0.75rem', borderRadius: '4px', border: '1px solid #fde68a' }}>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--status-yellow)', margin: '0 0 0.75rem 0', fontWeight: 'bold' }}>【監査】</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>担当者</label><input type="text" value={tempReport.staff} onChange={e => setTempReport({ ...tempReport, staff: e.target.value })} style={inputStyle} autoComplete="off" /></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>実施日</label><input type="date" value={tempReport.date} onChange={e => setTempReport({ ...tempReport, date: e.target.value })} style={inputStyle} /></div>
                  </div>
                  <div style={{ marginTop: '0.75rem' }}><label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>面談者</label><input type="text" value={tempReport.interviewee} onChange={e => setTempReport({ ...tempReport, interviewee: e.target.value })} style={inputStyle} /></div>
                  
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>給料明細</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => setTempReport({ ...tempReport, checkSalary: 'ok' })} style={{ padding: '2px 8px', fontSize: '0.7rem', border: '1px solid var(--card-border)', borderRadius: '4px', background: tempReport.checkSalary === 'ok' ? 'var(--status-green)' : 'white', color: tempReport.checkSalary === 'ok' ? 'white' : 'inherit', cursor: 'pointer' }}>適正</button>
                        <button onClick={() => setTempReport({ ...tempReport, checkSalary: 'ng' })} style={{ padding: '2px 8px', fontSize: '0.7rem', border: '1px solid var(--card-border)', borderRadius: '4px', background: tempReport.checkSalary === 'ng' ? 'var(--status-red)' : 'white', color: tempReport.checkSalary === 'ng' ? 'white' : 'inherit', cursor: 'pointer' }}>不備</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>実習日誌</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => setTempReport({ ...tempReport, checkLog: 'ok' })} style={{ padding: '2px 8px', fontSize: '0.7rem', border: '1px solid var(--card-border)', borderRadius: '4px', background: tempReport.checkLog === 'ok' ? 'var(--status-green)' : 'white', color: tempReport.checkLog === 'ok' ? 'white' : 'inherit', cursor: 'pointer' }}>適正</button>
                        <button onClick={() => setTempReport({ ...tempReport, checkLog: 'ng' })} style={{ padding: '2px 8px', fontSize: '0.7rem', border: '1px solid var(--card-border)', borderRadius: '4px', background: tempReport.checkLog === 'ng' ? 'var(--status-red)' : 'white', color: tempReport.checkLog === 'ng' ? 'white' : 'inherit', cursor: 'pointer' }}>不備</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VISIT SECTION (For both Visit and Audit months) */}
              <div style={{ background: 'var(--primary-light)', padding: '0.75rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: '0 0 0.75rem 0', fontWeight: 'bold' }}>{selectedCell.type === 'audit' ? '【訪問指導】' : '訪問指導 内容'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>担当者</label>
                    <input 
                      type="text" 
                      value={selectedCell.type === 'audit' ? tempReport.vStaff : tempReport.staff} 
                      onChange={e => selectedCell.type === 'audit' ? setTempReport({ ...tempReport, vStaff: e.target.value }) : setTempReport({ ...tempReport, staff: e.target.value })} 
                      style={inputStyle} 
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>実施日</label>
                    <input 
                      type="date" 
                      value={selectedCell.type === 'audit' ? tempReport.vDate : tempReport.date} 
                      onChange={e => selectedCell.type === 'audit' ? setTempReport({ ...tempReport, vDate: e.target.value }) : setTempReport({ ...tempReport, date: e.target.value })} 
                      style={inputStyle} 
                    />
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>面談者</label>
                  <input 
                    type="text" 
                    value={selectedCell.type === 'audit' ? tempReport.vInterviewee : tempReport.interviewee} 
                    onChange={e => selectedCell.type === 'audit' ? setTempReport({ ...tempReport, vInterviewee: e.target.value }) : setTempReport({ ...tempReport, interviewee: e.target.value })} 
                    style={inputStyle} 
                  />
                </div>
              </div>

              <div><label style={{ display: 'block', fontSize: '0.875rem' }}>備考欄</label><textarea value={tempReport.remarks} onChange={e => setTempReport({ ...tempReport, remarks: e.target.value })} style={{ ...inputStyle, height: '60px', resize: 'none' }}></textarea></div>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleRemoveSchedule} style={{ flex: '0 0 auto', padding: '0.6rem 0.8rem', border: '1px solid var(--status-red)', borderRadius: '4px', background: 'white', color: 'var(--status-red)', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>スケジュール解除</button>
              <button className="btn btn-primary" onClick={handleSaveReport} style={{ flex: 1, padding: '0.6rem' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* SET TYPE MODAL */}
      {modalMode === 'settype' && selectedCell && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div className="card card-modal" style={{ width: '300px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>{selectedCell.month}月 - スケジュール設定</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <button onClick={() => handleSetType('visit')} style={{ flex: 1, padding: '1rem', border: '2px solid var(--primary)', borderRadius: '4px', background: 'var(--primary-light)', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>訪問</button>
              <button onClick={() => handleSetType('audit')} style={{ flex: 1, padding: '1rem', border: '2px solid var(--status-yellow)', borderRadius: '4px', background: 'var(--status-yellow-bg)', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--status-yellow)' }}>監査</button>
            </div>
            <button onClick={() => setModalMode('none')} style={{ padding: '0.5rem 1.5rem', border: '1px solid var(--card-border)', borderRadius: '4px', background: 'white', cursor: 'pointer' }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* CARD VIEW (Mobile) */}
      {renderMobileView()}

      {/* MATRIX TABLE (Desktop) */}
      <div className="table-container desktop-only">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '1300px' }}>
          <thead style={{ background: '#f1f3f4', position: 'sticky', top: 0, zIndex: 30 }}>
            <tr>
              <th style={{ width: '30px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0', fontSize: '0.75rem' }}>No</th>
              <th className="sticky-col" style={{ textAlign: 'left', width: '160px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>企業名</th>
              <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>特定</th>
              <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>実2・3</th>
              <th style={{ width: '40px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>実1</th>
              <th style={{ width: '70px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: '0.7rem' }}>実1入国</th>
              {getFiscalMonths(fiscalYear).map(({ m }) => (
                <th key={m} style={{
                  borderRight: '1px solid var(--card-border)', width: '50px',
                  borderBottom: m === currentMonth ? '2px solid var(--status-red)' : '1px solid var(--card-border)',
                  background: m === currentMonth ? 'var(--status-red-bg)' : 'inherit',
                  color: m === currentMonth ? 'var(--status-red)' : 'inherit',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0'
                }}>
                  {m}月
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEnterprises.map((ent, idx) => {
              const isFirstMatch = searchTerm && idx === 0;
              const isMatching = searchTerm && ent.name.toLowerCase().includes(searchTerm.toLowerCase());
              
              return (
                <tr 
                  key={ent.id} 
                  ref={isFirstMatch ? scrollRef : null}
                  style={{ 
                    borderBottom: '1px solid var(--card-border)',
                    transition: 'all 0.5s ease',
                    background: isMatching ? '#fffbeb' : 'inherit'
                  }}
                >
                  <td style={{ fontSize: '0.7rem', borderRight: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td 
                    className="sticky-col" 
                    style={{ 
                      textAlign: 'left', 
                      borderRight: '1px solid var(--card-border)', 
                      cursor: 'pointer', 
                      color: isMatching ? 'var(--status-amber)' : 'var(--primary)', 
                      fontWeight: 'bold', 
                      padding: '0.5rem 0.75rem', 
                      fontSize: '0.8rem',
                      background: isMatching ? '#fffbeb' : 'white',
                      transition: 'all 0.5s ease',
                      boxShadow: isMatching ? 'inset 0 0 1px 1px var(--status-amber)' : '2px 0 5px rgba(0,0,0,0.05)'
                    }} 
                    onClick={() => { setTargetEnt(ent); setModalMode('edit'); }}
                  >
                    {isMatching && '🎯 '}{ent.name}
                  </td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', fontWeight: 'bold' }}>{ent.countTokutei}</td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', fontWeight: 'bold' }}>{ent.countJisshu23}</td>
                  <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', fontWeight: 'bold' }}>{ent.countJisshu1}</td>
                  <td style={{ fontSize: '0.75rem', borderRight: '1px solid var(--card-border)', color: 'var(--primary)', fontWeight: 'bold' }}>{ent.entryDateJisshu1 || '-'}</td>
                  {ent.schedule.map((cell, sIdx) => (
                    <td key={sIdx} style={{
                      borderRight: '1px solid var(--card-border)', padding: '2px',
                      background: cell.month === currentMonth ? '#fffafa' : 'inherit',
                      height: '42px'
                    }}>
                      {renderCellContent(cell, ent)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
