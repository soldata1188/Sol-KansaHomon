import React from 'react';
import { Enterprise, ScheduleCell, TaskType } from '@/lib/types';
import { formatShortDate } from '@/lib/utils';

interface MobileViewProps {
  filteredEnterprises: Enterprise[];
  searchTerm: string;
  focusMonth: number;
  realMonth: number;
  realFiscalYear: number;
  fiscalYear: number;
  onEditEnterprise: (ent: Enterprise) => void;
  openChecklist: (ent: Enterprise, month: number, type: TaskType) => void;
  scrollRef: React.RefObject<any>;
}

export const MobileView: React.FC<MobileViewProps> = ({
  filteredEnterprises, searchTerm, focusMonth, realMonth, realFiscalYear, fiscalYear,
  onEditEnterprise, openChecklist, scrollRef
}) => {
  const renderMobileMonthCell = (cell: ScheduleCell, ent: Enterprise) => {
    const isToday = cell.month === realMonth && fiscalYear === realFiscalYear;
    const isFocus = cell.month === focusMonth;
    const hasReport = !!cell.report?.date && !!cell.report?.staff;
    const isCompleted = cell.status === 'completed' || hasReport;
    const isAudit = cell.type === 'audit';
    
    let bg = 'transparent';
    let color = 'var(--text-muted)';
    let border = '1px solid var(--card-border)';
    
    if (cell.type !== 'none') {
      bg = 'transparent';
      color = isAudit ? 'var(--status-red)' : '#1E40AF';
      border = '1px solid var(--card-border)';
    }
    
    if (hasReport) {
      bg = isAudit ? '#fee2e2' : '#dbeafe';
      color = '#1e293b';
    } else if (isCompleted) {
      bg = isAudit ? 'var(--status-red-bg)' : 'var(--primary-light)';
      color = '#64748B';
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
          fontWeight: '500',
          fontSize: '0.65rem'
        }}
      >
        {isToday && (
          <span style={{ 
            position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px', 
            borderRadius: '50%', background: 'var(--status-red)', zIndex: 2
          }} />
        )}
        <span style={{ fontSize: '0.55rem', opacity: 0.5, lineHeight: 1 }}>{cell.month}月</span>
        {cell.type !== 'none' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '0.7rem', lineHeight: 1 }}>{isAudit ? '監' : '訪'}</span>
          </div>
        )}
        {cell.report && (
          <div style={{ fontSize: '0.5rem', fontWeight: 'normal', color: '#94A3B8', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', marginTop: '1px' }}>
            {cell.report.date ? formatShortDate(cell.report.date) : ''} {cell.report.staff && `(${cell.report.staff})`}
          </div>
        )}
      </div>
    );
  };

  return (
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
            <div className="card-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }} onClick={() => onEditEnterprise(ent)}>
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
};
