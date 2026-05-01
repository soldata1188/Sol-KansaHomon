import React from 'react';
import { Enterprise } from '@/lib/types';
import { formatShortDate, getTrainingStatus } from '@/lib/utils';

interface TrainingTableProps {
  filteredEnterprises: Enterprise[];
  searchTerm: string;
  onEditEnterprise: (ent: Enterprise) => void;
  scrollRef: React.RefObject<any>;
}

export const TrainingTable: React.FC<TrainingTableProps> = ({
  filteredEnterprises, searchTerm, onEditEnterprise, scrollRef
}) => {
  return (
    <div className="table-container" style={{ flex: 1, overflow: 'auto', background: 'white', border: '1px solid var(--table-border)', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '850px' }}>
        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 30 }}>
          <tr>
            <th style={{ width: '40px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.4rem 0', fontSize: '0.75rem' }}>No</th>
            <th className="sticky-col" style={{ textAlign: 'center', width: '180px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#f8fafc' }}>企業名</th>
            <th style={{ textAlign: 'center', width: '60px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', padding: '0.4rem 0', fontSize: '0.75rem' }}>受入区分</th>
            <th style={{ width: '120px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', fontSize: '0.75rem' }}>責任者</th>
            <th style={{ width: '100px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', fontSize: '0.75rem' }}>責任受講日</th>
            <th style={{ width: '120px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', fontSize: '0.75rem' }}>指導員</th>
            <th style={{ width: '100px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', fontSize: '0.75rem' }}>指導受講日</th>
            <th style={{ width: '120px', borderRight: '1px solid var(--table-border)', borderBottom: '1px solid var(--table-border)', fontSize: '0.75rem' }}>生活員</th>
            <th style={{ width: '100px', borderBottom: '1px solid var(--table-border)', fontSize: '0.75rem' }}>生活受講日</th>
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
              <tr key={ent.id} ref={isFirstMatch ? scrollRef : null} style={{ borderBottom: '1px solid var(--table-border)', background: isMatching ? '#fffbeb' : 'inherit' }}>
                <td style={{ fontSize: '0.75rem', borderRight: '1px solid var(--table-border)', color: '#94a3b8' }}>{idx + 1}</td>
                <td className="sticky-col" onClick={() => onEditEnterprise(ent)} style={{ textAlign: 'left', borderRight: '1px solid var(--table-border)', cursor: 'pointer', color: isMatching ? 'var(--status-amber)' : 'var(--primary)', fontWeight: 'bold', padding: '0.6rem 0.75rem', fontSize: '0.85rem', background: isMatching ? '#fffbeb' : 'white', position: 'sticky', left: 0, zIndex: 10 }}>{isMatching && '🎯 '}{ent.name}</td>
                <td style={{ borderRight: '1px solid var(--table-border)', padding: '2px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                    {(ent.acceptTypes || []).map(t => (
                      <span key={t} style={{ fontSize: '0.55rem', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 4px', borderRadius: '3px', color: '#475569', lineHeight: 1 }}>{t}</span>
                    ))}
                  </div>
                </td>
                <td style={{ borderRight: '1px solid var(--table-border)', fontSize: '0.8rem', color: ent.respName ? 'inherit' : '#94a3b8' }}>{ent.respName || '-'}</td>
                <td style={{ borderRight: '1px solid var(--table-border)', fontSize: '0.75rem' }}>
                  {ent.respDate ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
                    <span>{formatShortDate(ent.respDate)}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: respStat.bg, color: respStat.color, fontWeight: respStat.isWarning ? 'bold' : 'normal', border: `1px solid ${respStat.color}40` }}>{respStat.text}</span>
                  </div> : <span style={{ color: '#94a3b8' }}>-</span>}
                </td>
                <td style={{ borderRight: '1px solid var(--table-border)', fontSize: '0.8rem', color: ent.instrName ? 'inherit' : '#94a3b8' }}>{ent.instrName || '-'}</td>
                <td style={{ borderRight: '1px solid var(--table-border)', fontSize: '0.75rem' }}>
                  {ent.instrDate ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
                    <span>{formatShortDate(ent.instrDate)}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: instrStat.bg, color: instrStat.color, fontWeight: instrStat.isWarning ? 'bold' : 'normal', border: `1px solid ${instrStat.color}40` }}>{instrStat.text}</span>
                  </div> : <span style={{ color: '#94a3b8' }}>-</span>}
                </td>
                <td style={{ borderRight: '1px solid var(--table-border)', fontSize: '0.8rem', color: ent.lifeName ? 'inherit' : '#94a3b8' }}>{ent.lifeName || '-'}</td>
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
};
