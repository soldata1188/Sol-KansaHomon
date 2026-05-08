import React from 'react';

interface ToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterMode: string;
  setFilterMode: (val: 'all' | 'audit' | 'visit' | 'pending' | 'month') => void;
  viewMode: 'schedule' | 'training';
  setViewMode: (val: 'schedule' | 'training') => void;
  fiscalYear: number;
  changeFiscalYear: (year: number) => void;
  filteredCount: number;
  totalCount: number;
  isSyncing?: boolean;
  onRefresh?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  searchTerm, setSearchTerm, filterMode, setFilterMode, viewMode, setViewMode,
  fiscalYear, changeFiscalYear,
  filteredCount, totalCount, isSyncing, onRefresh
}) => {
  return (
    <>
      {/* Search & Filter Bar */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '0.8rem' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <input type="text" placeholder="企業名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.8rem', borderRadius: '4px', border: '1px solid var(--card-border)', fontSize: '0.8rem' }} />
          <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem' }}>🔍</span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {viewMode === 'schedule' && [
            {id:'all' as const, label:'すべて', icon:'◉', activeColor:'#1D4ED8', activeBg:'#EFF6FF', activeBorder:'#BFDBFE'},
            {id:'audit' as const, label:'監査', icon:'🔴', activeColor:'#DC2626', activeBg:'#FEF2F2', activeBorder:'#FECACA'},
            {id:'visit' as const, label:'訪問', icon:'🔵', activeColor:'#1D4ED8', activeBg:'#EFF6FF', activeBorder:'#BFDBFE'},
            {id:'pending' as const, label:'未完', icon:'⏳', activeColor:'#D97706', activeBg:'#FFFBEB', activeBorder:'#FDE68A'},
            ...(filterMode === 'month' ? [{id:'month' as const, label:'月別', icon:'📅', activeColor:'#7C3AED', activeBg:'#F5F3FF', activeBorder:'#DDD6FE'}] : [])
          ].map(f => {
            const isActive = filterMode === f.id;
            return (
              <button 
                key={f.id} 
                onClick={() => setFilterMode(f.id)} 
                style={{ 
                  padding: '0.35rem 0.75rem', 
                  fontSize: '0.75rem', 
                  fontWeight: isActive ? '700' : '500', 
                  cursor: 'pointer', 
                  background: isActive ? f.activeBg : 'white', 
                  border: isActive ? `1.5px solid ${f.activeBorder}` : '1px solid #E2E8F0', 
                  borderRadius: '20px',
                  color: isActive ? f.activeColor : '#64748B',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  boxShadow: isActive ? `0 1px 4px ${f.activeBorder}80` : 'none',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                <span style={{ fontSize: '0.6rem' }}>{f.icon}</span>
                {f.label}
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>表示: <strong>{filteredCount}</strong> / {totalCount} 社</span>
          <button 
            onClick={onRefresh} 
            disabled={isSyncing}
            title="クラウドから再読み込み"
            style={{ 
              padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: isSyncing ? 'wait' : 'pointer', 
              background: 'white', border: '1px solid var(--card-border)', borderRadius: '4px', 
              color: 'var(--primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.3rem',
              opacity: isSyncing ? 0.6 : 1, transition: 'all 0.2s'
            }}
          >
            <span style={{ display: 'inline-block', animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {isSyncing ? '同期中...' : '再読込'}
          </button>
        </div>
      </div>

      {/* Navigation & View Toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', marginBottom: '0.8rem' }}>
        <div className="view-toggle" style={{ display: 'flex', gap: '1.5rem' }}>
          <button onClick={() => setViewMode('schedule')} style={{ padding: '0.5rem 0', background: 'transparent', border: 'none', color: viewMode === 'schedule' ? 'var(--primary)' : 'var(--text-main)', fontWeight: viewMode === 'schedule' ? '600' : '500', cursor: 'pointer', borderBottom: viewMode === 'schedule' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-1px' }}>📅 スケジュール管理</button>
          <button onClick={() => setViewMode('training')} style={{ padding: '0.5rem 0', background: 'transparent', border: 'none', color: viewMode === 'training' ? 'var(--primary)' : 'var(--text-main)', fontWeight: viewMode === 'training' ? '600' : '500', cursor: 'pointer', borderBottom: viewMode === 'training' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-1px' }}>🎓 受講・責任者管理</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'var(--card-bg)', padding: '0.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--card-border)', marginBottom: '0.4rem' }}>
          {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
            <button 
              key={year} 
              onClick={() => changeFiscalYear(year)} 
              style={{ 
                padding: '0.3rem 0.8rem', 
                fontSize: '0.75rem', 
                fontWeight: fiscalYear === year ? '600' : '500', 
                cursor: 'pointer', 
                background: fiscalYear === year ? 'var(--primary)' : 'transparent', 
                color: fiscalYear === year ? 'white' : 'var(--text-main)', 
                border: 'none', 
                borderRadius: 'calc(var(--radius) - 2px)',
                transition: 'all 0.2s'
              }}
            >
              {year}年度
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
