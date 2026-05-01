import React from 'react';
import { TaskType } from '@/lib/types';

interface SetTypeModalProps {
  month: number;
  onSetType: (type: TaskType) => void;
  onClose: () => void;
}

export const SetTypeModal: React.FC<SetTypeModalProps> = ({ month, onSetType, onClose }) => {
  return (
    <div style={{ 
      position: 'fixed', inset: 0, 
      background: 'rgba(0,0,0,0.4)', 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div className="card" style={{ 
        width: '100%', maxWidth: '320px', 
        padding: '1.5rem',
        border: '1px solid var(--card-border)',
        borderRadius: '8px'
      }}>
        <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--primary)', margin: '0 0 0.25rem 0' }}>
            {month}月のスケジュール設定
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>タスクの種類を選択</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            onClick={() => onSetType('visit')}
            className="btn"
            style={{ 
              width: '100%', padding: '0.75rem', 
              background: 'white', color: '#1E40AF', 
              border: '1px solid #bfdbfe', fontWeight: '500',
              textAlign: 'center'
            }}
          >
            訪問 (巡回指導)
          </button>

          <button 
            onClick={() => onSetType('audit')}
            className="btn"
            style={{ 
              width: '100%', padding: '0.75rem', 
              background: 'white', color: 'var(--status-red)', 
              border: '1px solid #fecaca', fontWeight: '500',
              textAlign: 'center'
            }}
          >
            監査 (法的監査)
          </button>
        </div>

        <button 
          className="btn btn-ghost" 
          onClick={onClose}
          style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

