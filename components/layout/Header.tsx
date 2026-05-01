import React from 'react';

interface HeaderProps {
  isSyncing: boolean;
  onAddEnterprise: () => void;
  logout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isSyncing, onAddEnterprise, logout }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <h1 style={{ fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
        <span style={{ fontSize: '1.4rem' }}>📋</span> SOL 監査・訪問管理
        <span style={{ 
          fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '500', marginTop: '0.2rem'
        }}>
          <span style={{ 
            display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', 
            background: isSyncing ? '#f59e0b' : '#10b981',
            boxShadow: isSyncing ? '0 0 4px #f59e0b' : 'none',
            transition: 'all 0.3s ease'
          }}></span>
          {isSyncing ? '同期中...' : 'クラウド同期済み'}
        </span>
      </h1>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={onAddEnterprise}>+ 企業登録</button>
        <button className="btn btn-ghost" onClick={logout}>ログアウト</button>
      </div>
    </div>
  );
};
