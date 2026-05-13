import React from 'react';
import { Enterprise, SortColumn } from '@/lib/types';
import { formatShortDate, getTrainingStatus } from '@/lib/utils';

interface TrainingTableProps {
  filteredEnterprises: Enterprise[];
  searchTerm: string;
  onEditEnterprise: (ent: Enterprise) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scrollRef: React.RefObject<any>;
  sortColumn?: SortColumn;
  sortDirection?: 'asc' | 'desc';
  onSort?: (col: SortColumn) => void;
}

export const TrainingTable: React.FC<TrainingTableProps> = ({
  filteredEnterprises, searchTerm, onEditEnterprise, scrollRef, sortColumn, sortDirection, onSort
}) => {
  const renderDateCell = (date?: string) => {
    if (!date) return <span style={{ color: '#94a3b8' }}>-</span>;
    const stat = getTrainingStatus(date);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '0.7rem' }}>{formatShortDate(date)}</span>
        <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: stat.bg, color: stat.color, fontWeight: stat.isWarning ? 'bold' : 'normal', border: `1px solid ${stat.color}40`, whiteSpace: 'nowrap' }}>{stat.text}</span>
      </div>
    );
  };

  return (
    <div className="table-container" style={{ flex: 1, overflow: 'auto', background: 'white', border: '1px solid var(--table-border)', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '850px' }}>
        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 30 }}>
          <tr>
            <th style={{ textAlign: 'center', width: '30px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>No</th>
            <th className="sticky-col" onClick={() => onSort?.('name')} style={{ cursor: 'pointer', textAlign: 'center', width: '160px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: '#f8fafc' }}>
              企業名 {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th onClick={() => onSort?.('acceptTypes')} style={{ cursor: 'pointer', textAlign: 'center', width: '50px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>
              受入区分 {sortColumn === 'acceptTypes' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th style={{ textAlign: 'center', width: '80px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>責任者</th>
            <th style={{ textAlign: 'center', width: '140px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>責任受講日</th>
            <th style={{ textAlign: 'center', width: '80px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>指導員</th>
            <th style={{ textAlign: 'center', width: '140px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>指導受講日</th>
            <th style={{ textAlign: 'center', width: '80px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>生活員</th>
            <th style={{ textAlign: 'center', width: '140px', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>生活受講日</th>
          </tr>
        </thead>
        <tbody>
          {filteredEnterprises.map((ent, idx) => {
            const isFirstMatch = searchTerm && idx === 0;
            const isMatching = searchTerm && ent.name.toLowerCase().includes(searchTerm.toLowerCase());
            const isTokuteiOnly = ent.acceptTypes?.length === 1 && ent.acceptTypes[0] === '特定';
            const rowBg = isMatching ? '#fffbeb' : isTokuteiOnly ? '#F1F5F9' : 'inherit';
            const stickyBg = isMatching ? '#fffbeb' : isTokuteiOnly ? '#F1F5F9' : 'white';

            return (
              <tr key={ent.id} ref={isFirstMatch ? scrollRef : null} style={{ borderBottom: '1px solid var(--card-border)', background: rowBg }}>
                <td style={{ fontSize: '0.7rem', borderRight: '1px solid var(--card-border)', color: '#94a3b8', textAlign: 'center' }}>{idx + 1}</td>
                <td className="sticky-col" onClick={() => onEditEnterprise(ent)} style={{ textAlign: 'left', borderRight: '1px solid var(--card-border)', cursor: 'pointer', color: isMatching ? 'var(--status-amber)' : isTokuteiOnly ? '#94A3B8' : 'var(--foreground)', fontWeight: 'bold', padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: stickyBg, position: 'sticky', left: 0, zIndex: 10 }}>{isMatching && '🎯 '}{ent.name}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', padding: '2px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '2px', alignItems: 'center', justifyContent: 'flex-start' }}>
                    {(ent.acceptTypes || []).map(t => {
                      const short = t === '実習' ? '実' : t === '特定' ? '特' : t === '育成' ? '育' : t[0];
                      const colorMap: Record<string, { bg: string; border: string; color: string }> = {
                        '実習': { bg: '#F0FDF4', border: '#86EFAC', color: '#15803D' },
                        '特定': { bg: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8' },
                        '育成': { bg: '#F5F3FF', border: '#C4B5FD', color: '#7C3AED' },
                      };
                      const c = colorMap[t] || { bg: '#f8fafc', border: '#cbd5e1', color: '#475569' };
                      return (
                        <span key={t} style={{ fontSize: '0.6rem', fontWeight: 'bold', background: c.bg, border: `1px solid ${c.border}`, padding: '2px', borderRadius: '3px', color: c.color, lineHeight: 1, width: '16px', textAlign: 'center', display: 'inline-block' }}>{short}</span>
                      );
                    })}
                  </div>
                </td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', color: ent.respName ? 'inherit' : '#94a3b8' }}>{ent.respName || '-'}</td>
                <td style={{ borderRight: '1px solid var(--card-border)' }}>{renderDateCell(ent.respDate)}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', color: ent.instrName ? 'inherit' : '#94a3b8' }}>{ent.instrName || '-'}</td>
                <td style={{ borderRight: '1px solid var(--card-border)' }}>{renderDateCell(ent.instrDate)}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem', color: ent.lifeName ? 'inherit' : '#94a3b8' }}>{ent.lifeName || '-'}</td>
                <td>{renderDateCell(ent.lifeDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
