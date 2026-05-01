import React from 'react';
import { Enterprise } from '@/lib/types';

interface EnterpriseModalProps {
  modalMode: 'add' | 'edit';
  targetEnt: Enterprise;
  setTargetEnt: (ent: Enterprise) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (ent: Enterprise) => void;
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({
  modalMode, targetEnt, setTargetEnt, onClose, onSave, onDelete
}) => {
  const inputStyle = { width: '100%', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '4px', boxSizing: 'border-box' as const };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div className="card card-modal" style={{ width: '400px' }}>
        <h3>{modalMode === 'add' ? '実習実施者の登録' : '実習実施者の編集'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>企業名</label>
            <input type="text" placeholder="企業名" value={targetEnt.name} onChange={e => setTargetEnt({...targetEnt, name: e.target.value})} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>特・実・育</label>
              <input type="number" placeholder="0" value={targetEnt.countTokutei + targetEnt.countJisshu23} onChange={e => setTargetEnt({...targetEnt, countTokutei: parseInt(e.target.value)||0, countJisshu23: 0})} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>内1年目</label>
              <input type="number" placeholder="0" value={targetEnt.countJisshu1} onChange={e => setTargetEnt({...targetEnt, countJisshu1: parseInt(e.target.value)||0})} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>内1年目入国日</label>
            <input type="date" value={targetEnt.entryDateJisshu1} onChange={e => setTargetEnt({...targetEnt, entryDateJisshu1: e.target.value})} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>責任者</label>
              <input type="text" placeholder="氏名" value={targetEnt.respName || ''} onChange={e => setTargetEnt({...targetEnt, respName: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>責任受講日</label>
              <input type="date" value={targetEnt.respDate || ''} onChange={e => setTargetEnt({...targetEnt, respDate: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>指導員</label>
              <input type="text" placeholder="氏名" value={targetEnt.instrName || ''} onChange={e => setTargetEnt({...targetEnt, instrName: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>指導受講日</label>
              <input type="date" value={targetEnt.instrDate || ''} onChange={e => setTargetEnt({...targetEnt, instrDate: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>生活員</label>
              <input type="text" placeholder="氏名" value={targetEnt.lifeName || ''} onChange={e => setTargetEnt({...targetEnt, lifeName: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>生活受講日</label>
              <input type="date" value={targetEnt.lifeDate || ''} onChange={e => setTargetEnt({...targetEnt, lifeDate: e.target.value})} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
            {modalMode === 'edit' && (
              <button className="btn" style={{ background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => onDelete(targetEnt)}>🗑️ 削除</button>
            )}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={onSave}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
};
