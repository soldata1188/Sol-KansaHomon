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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
      {/* View tabs */}
      <div className="view-toggle" style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
        <button onClick={() => setViewMode('schedule')} style={{ padding: '0.3rem 0', background: 'transparent', border: 'none', color: viewMode === 'schedule' ? 'var(--primary)' : 'var(--text-main)', fontWeight: viewMode === 'schedule' ? '600' : '500', cursor: 'pointer', borderBottom: viewMode === 'schedule' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-0.55rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>📅 スケジュール管理</button>
        <button onClick={() => setViewMode('training')} style={{ padding: '0.3rem 0', background: 'transparent', border: 'none', color: viewMode === 'training' ? 'var(--primary)' : 'var(--text-main)', fontWeight: viewMode === 'training' ? '600' : '500', cursor: 'pointer', borderBottom: viewMode === 'training' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-0.55rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>🎓 受講・責任者管理</button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', minWidth: '160px', maxWidth: '240px', flex: '1' }}>
        <input type="text" placeholder="企業名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.3rem 0.4rem 0.3rem 1.6rem', borderRadius: '4px', border: '1px solid var(--card-border)', fontSize: '0.75rem' }} />
        <span style={{ position: 'absolute', left: '0.4rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem' }}>🔍</span>
      </div>

      {/* Filter toggles */}
      {viewMode === 'schedule' && (
        <div className="filter-bar" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {[
            {id:'all' as const, label:'すべて', activeColor:'#1D4ED8'},
            {id:'audit' as const, label:'監査', activeColor:'#DC2626'},
            {id:'visit' as const, label:'訪問', activeColor:'#1D4ED8'},
            {id:'pending' as const, label:'未完', activeColor:'#D97706'},
            ...(filterMode === 'month' ? [{id:'month' as const, label:'月別', activeColor:'#7C3AED'}] : [])
          ].map(f => {
            const isActive = filterMode === f.id;
            return (
              <button 
                key={f.id} 
                onClick={() => setFilterMode(f.id)} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.15rem 0.3rem', 
                  fontSize: '0.68rem', fontWeight: '500',
                  cursor: 'pointer', 
                  background: 'transparent', 
                  border: 'none',
                  color: isActive ? f.activeColor : '#94A3B8',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  width: '24px', height: '14px',
                  borderRadius: '7px',
                  background: isActive ? f.activeColor : '#CBD5E1',
                  position: 'relative',
                  transition: 'background 0.2s ease',
                  flexShrink: 0,
                }}>
                  <span style={{
                    width: '10px', height: '10px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    left: isActive ? '12px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  }} />
                </span>
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Right side: count + fiscal year + refresh */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>表示: <strong>{filteredCount}</strong> / {totalCount} 社</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', background: 'var(--card-bg)', padding: '0.15rem', borderRadius: 'var(--radius)', border: '1px solid var(--card-border)' }}>
          {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
            <button 
              key={year} 
              onClick={() => changeFiscalYear(year)} 
              style={{ 
                padding: '0.2rem 0.5rem', 
                fontSize: '0.7rem', 
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
        <button 
          onClick={onRefresh} 
          disabled={isSyncing}
          title="クラウドから再読み込み"
          style={{ 
            padding: '0.25rem 0.5rem', fontSize: '0.65rem', cursor: isSyncing ? 'wait' : 'pointer', 
            background: 'white', border: '1px solid var(--card-border)', borderRadius: '4px', 
            color: 'var(--primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.2rem',
            opacity: isSyncing ? 0.6 : 1, transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}
        >
          <span style={{ display: 'inline-block', animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {isSyncing ? '同期中...' : '再読込'}
        </button>
      </div>
    </div>
  );
};
