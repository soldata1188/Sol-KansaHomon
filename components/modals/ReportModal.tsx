import React from 'react';
import { Report, Enterprise } from '@/lib/types';

interface ReportModalProps {
  selectedCell: { entId: string; month: number; type: string };
  enterprises: Enterprise[];
  tempReport: Report;
  setTempReport: (report: Report) => void;
  onClose: () => void;
  onSave: () => void;
  onRemove: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  selectedCell, enterprises, tempReport, setTempReport, onClose, onSave, onRemove
}) => {
  const entName = enterprises.find(e => e.id === selectedCell.entId)?.name || '';
  const isAudit = selectedCell.type === 'audit';
  const inputStyle = { width: '100%', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '4px', boxSizing: 'border-box' as const };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
      <div className="card card-modal" style={{ width: '480px', maxHeight: '92vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
          <span>📝 {entName} — {selectedCell.month}月 入力</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', padding: '0 5px' }}>×</button>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onRemove}
            style={{ flex: '0 0 auto', padding: '0.6rem 0.9rem', border: '1px solid var(--status-red)', borderRadius: '4px', background: 'white', color: 'var(--status-red)', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            スケジュール解除
          </button>
          <button className="btn btn-primary" onClick={onSave} style={{ flex: 1, padding: '0.6rem' }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
