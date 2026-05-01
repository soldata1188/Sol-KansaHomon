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
      background: 'rgba(15, 23, 42, 0.6)', 
      backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div className="card" style={{ 
        width: '100%', maxWidth: '440px', 
        textAlign: 'center', 
        padding: '2rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--foreground)', margin: '0 0 0.5rem 0' }}>
            {month}月のスケジュール設定
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>実施するタスクの種類を選択してください</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Visit Card */}
          <div 
            onClick={() => onSetType('visit')}
            className="selection-card"
            style={{
              padding: '1.25rem',
              border: '2px solid var(--card-border)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'white'
            }}
          >
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', 
              background: 'var(--primary-light)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              🏠
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--primary)' }}>訪問</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>巡回指導・状況確認</div>
            </div>
          </div>

          {/* Audit Card */}
          <div 
            onClick={() => onSetType('audit')}
            className="selection-card"
            style={{
              padding: '1.25rem',
              border: '2px solid var(--card-border)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'white'
            }}
          >
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', 
              background: 'var(--status-red-bg)', color: 'var(--status-red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              ⚖️
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--status-red)' }}>監査</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>3ヶ月に一度の法的監査</div>
            </div>
          </div>
        </div>

        <button 
          className="btn btn-ghost" 
          onClick={onClose}
          style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}
        >
          キャンセル
        </button>

        <style jsx>{`
          .selection-card:hover {
            transform: translateY(-4px);
            border-color: var(--primary);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          }
          .selection-card:active {
            transform: translateY(0);
          }
        `}</style>
      </div>
    </div>
  );
};

