import React, { useState, useRef as useRefLocal, useEffect } from 'react';
import { Enterprise, ScheduleCell, TaskType, SortColumn } from '@/lib/types';
import { MONTHS } from '@/lib/constants';
import { formatShortDate } from '@/lib/utils';

interface ScheduleTableProps {
  filteredEnterprises: Enterprise[];
  searchTerm: string;
  focusMonth: number;
  realMonth: number;
  realFiscalYear: number;
  fiscalYear: number;
  onEditEnterprise: (ent: Enterprise) => void;
  openChecklist: (ent: Enterprise, month: number, type: TaskType) => void;
  onSetType: (entId: string, month: number, type: TaskType) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scrollRef: React.RefObject<any>;
  onMonthClick?: (month: number) => void;
  filterMode?: string;
  sortColumn?: SortColumn;
  sortDirection?: 'asc' | 'desc';
  onSort?: (col: SortColumn) => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({
  filteredEnterprises, searchTerm, focusMonth, realMonth, realFiscalYear, fiscalYear,
  onEditEnterprise, openChecklist, onSetType, scrollRef, onMonthClick, filterMode,
  sortColumn, sortDirection, onSort
}) => {
  const [popover, setPopover] = useState<{ entId: string; month: number; x: number; y: number } | null>(null);
  const popoverRef = useRefLocal<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!popover) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popover]);

  const handlePlusClick = (e: React.MouseEvent, ent: Enterprise, month: number) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ entId: ent.id, month, x: rect.left + rect.width / 2, y: rect.bottom + 4 });
  };

  const handlePopoverSelect = (type: TaskType) => {
    if (!popover) return;
    onSetType(popover.entId, popover.month, type);
    setPopover(null);
  };

  const renderCellContent = (cell: ScheduleCell, ent: Enterprise) => {
    const isToday = cell.month === realMonth && fiscalYear === realFiscalYear;
    if (cell.type === 'none') {
      return (
        <div 
          onClick={(e) => handlePlusClick(e, ent, cell.month)}
          style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <span style={{ color: '#E2E8F0', fontSize: '0.7rem' }}>＋</span>
        </div>
      );
    }
    const hasReport = !!cell.report?.date && !!cell.report?.staff;
    const isCompleted = cell.status === 'completed' || hasReport;
    const isAudit = cell.type === 'audit';

    const baseColor = isAudit ? 'var(--status-red)' : 'var(--primary)';
    const labelColor = isCompleted ? '#64748B' : baseColor;
    
    let bgColor = 'transparent';
    if (hasReport) {
      bgColor = isAudit ? '#fee2e2' : '#dbeafe';
    } else if (isCompleted) {
      bgColor = isAudit ? 'var(--status-red-bg)' : 'var(--primary-light)';
    }

    return (
      <div 
        onClick={() => openChecklist(ent, cell.month, cell.type)}
        style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: '4px 2px', height: '100%',
          background: bgColor
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isToday && (
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--status-red)', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '0.7rem', fontWeight: '500', color: labelColor, letterSpacing: '0.02em' }}>
            {isAudit ? '監' : '訪'}
          </span>
        </div>
        {cell.report && (
          <div style={{ fontSize: '0.6rem', color: '#94A3B8', lineHeight: 1, marginTop: '2px', display: 'flex', gap: '3px', whiteSpace: 'nowrap' }}>
            {cell.report.date && <span>{formatShortDate(cell.report.date)}</span>}
            {cell.report.staff && <span style={{ color: isCompleted ? '#64748B' : '#94A3B8', fontWeight: '500' }}>{cell.report.staff}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="table-container desktop-only" style={{ flex: 1, overflow: 'auto', background: 'white', border: '1px solid var(--table-border)', borderRadius: '4px', position: 'relative' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '1300px' }}>
        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 30 }}>
          <tr>
            <th style={{ textAlign: 'center', width: '30px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>No</th>
            <th className="sticky-col" onClick={() => onSort?.('name')} style={{ cursor: 'pointer', textAlign: 'center', width: '160px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: '#f8fafc' }}>
              企業名 {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th onClick={() => onSort?.('acceptTypes')} style={{ cursor: 'pointer', textAlign: 'center', width: '50px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>
              受入区分 {sortColumn === 'acceptTypes' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th onClick={() => onSort?.('countForeigners')} style={{ cursor: 'pointer', textAlign: 'center', width: '50px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>
              外国人数 {sortColumn === 'countForeigners' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th onClick={() => onSort?.('countJisshu1')} style={{ cursor: 'pointer', textAlign: 'center', width: '50px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>
              内1年目 {sortColumn === 'countJisshu1' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th onClick={() => onSort?.('entryDateJisshu1')} style={{ cursor: 'pointer', textAlign: 'center', width: '50px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.2rem 0', fontSize: '0.7rem' }}>
              内1年目入国 {sortColumn === 'entryDateJisshu1' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            {MONTHS.map(m => {
              const isTodayMonth = m === realMonth && fiscalYear === realFiscalYear;
              const isFocusMonth = m === focusMonth && filterMode === 'month';
              
              return (
                <th 
                  key={m} 
                  onClick={() => onMonthClick?.(m)}
                  style={{ 
                    borderRight: '1px solid var(--table-border)', 
                    width: '50px', 
                    borderBottom: isTodayMonth ? '2px solid var(--primary)' : '1px solid var(--table-border)', 
                    background: isFocusMonth ? 'var(--primary)' : (isTodayMonth ? 'var(--primary-light)' : 'inherit'), 
                    fontSize: '0.75rem', 
                    color: isFocusMonth ? 'white' : (isTodayMonth ? 'var(--primary)' : undefined), 
                    fontWeight: isTodayMonth ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: '0.2rem 0'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', lineHeight: 1.1 }}>
                    <span>{m}月</span>
                    {isFocusMonth && <span style={{ fontSize: '0.5rem', color: 'white' }}>●</span>}
                    {!isFocusMonth && isTodayMonth && <span style={{ fontSize: '0.45rem', color: 'var(--primary)' }}>Today</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filteredEnterprises.map((ent, idx) => {
            const isFirstMatch = searchTerm && idx === 0;
            const isMatching = searchTerm && ent.name.toLowerCase().includes(searchTerm.toLowerCase());
            return (
              <tr key={ent.id} ref={isFirstMatch ? scrollRef : null} style={{ borderBottom: '1px solid var(--card-border)', background: isMatching ? '#fffbeb' : 'inherit' }}>
                <td style={{ fontSize: '0.7rem', borderRight: '1px solid var(--card-border)', color: '#94a3b8' }}>{idx + 1}</td>
                <td className="sticky-col" onClick={() => onEditEnterprise(ent)} style={{ textAlign: 'left', borderRight: '1px solid var(--card-border)', cursor: 'pointer', color: isMatching ? 'var(--status-amber)' : 'var(--primary)', fontWeight: 'bold', padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: isMatching ? '#fffbeb' : 'white', position: 'sticky', left: 0, zIndex: 10 }}>{isMatching && '🎯 '}{ent.name}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', padding: '2px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                    {(ent.acceptTypes || []).map(t => {
                      const short = t === '実習' ? '実' : t === '特定' ? '特' : t === '育成' ? '育' : t[0];
                      return (
                        <span key={t} style={{ fontSize: '0.6rem', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '2px', borderRadius: '3px', color: '#475569', lineHeight: 1, width: '16px', textAlign: 'center', display: 'inline-block' }}>{short}</span>
                      );
                    })}
                  </div>
                </td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem' }}>{ent.countTokutei + ent.countJisshu23}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.8rem' }}>{ent.countJisshu1}</td>
                <td style={{ borderRight: '1px solid var(--card-border)', fontSize: '0.7rem' }}>{ent.entryDateJisshu1 || '-'}</td>
                {ent.schedule.map((cell, sIdx) => (
                  <td key={sIdx} style={{ borderRight: '1px solid var(--card-border)', padding: '2px', background: 'inherit' }}>
                    {renderCellContent(cell, ent)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Inline Popover */}
      {popover && (
        <div 
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: popover.x,
            top: popover.y,
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Arrow */}
          <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid #e2e8f0' }} />
          {/* Card */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
            display: 'flex',
            gap: '3px',
            padding: '3px',
          }}>
            <button
              onClick={() => handlePopoverSelect('visit')}
              style={{
                padding: '4px 10px', fontSize: '0.65rem', fontWeight: '500', letterSpacing: '0.03em',
                background: 'transparent', color: '#1D4ED8', border: 'none',
                borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              訪問
            </button>
            <div style={{ width: '1px', background: '#f1f5f9', margin: '3px 0' }} />
            <button
              onClick={() => handlePopoverSelect('audit')}
              style={{
                padding: '4px 10px', fontSize: '0.65rem', fontWeight: '500', letterSpacing: '0.03em',
                background: 'transparent', color: '#DC2626', border: 'none',
                borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              監査
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
