import React from 'react';

interface ToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterMode: string;
  setFilterMode: (val: any) => void;
  viewMode: 'schedule' | 'training';
  setViewMode: (val: 'schedule' | 'training') => void;
  fiscalYear: number;
  changeFiscalYear: (year: number) => void;
  filteredCount: number;
  totalCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  searchTerm, setSearchTerm, filterMode, setFilterMode, viewMode, setViewMode,
  fiscalYear, changeFiscalYear,
  filteredCount, totalCount
}) => {
  return (
    <>
      {/* Search & Filter Bar */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '0.8rem' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <input type="text" placeholder="企業名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.8rem', borderRadius: '4px', border: '1px solid var(--card-border)', fontSize: '0.8rem' }} />
          <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem' }}>🔍</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {viewMode === 'schedule' && [
            {id:'all',label:'すべて'},
            {id:'audit',label:'監査'},
            {id:'visit',label:'訪問'},
            {id:'pending',label:'未完'},
            ...(filterMode === 'month' ? [{id:'month',label:'月別'}] : [])
          ].map(f => (
            <button key={f.id} onClick={() => setFilterMode(f.id)} style={{ padding: '0.3rem 0', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer', background: 'transparent', border: 'none', color: filterMode === f.id ? 'var(--primary)' : 'var(--text-muted)', borderBottom: filterMode === f.id ? '2px solid var(--primary)' : '2px solid transparent' }}>{f.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>表示: <strong>{filteredCount}</strong> / {totalCount} 社</div>
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
