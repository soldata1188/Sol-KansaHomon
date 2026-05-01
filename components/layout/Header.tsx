import React from 'react';

interface HeaderProps {
  isSyncing: boolean;
  syncToCloud: () => void;
  onAddEnterprise: () => void;
  logout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isSyncing, syncToCloud, onAddEnterprise, logout }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <h1 style={{ fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
        <span style={{ fontSize: '1.4rem' }}>📋</span> SOL 監査・訪問管理
        <span style={{ 
          fontSize: '0.65rem', background: isSyncing ? '#fff7ed' : '#f0fdf4', color: isSyncing ? '#9a3412' : '#166534', 
          padding: '2px 8px', borderRadius: '12px', border: `1px solid ${isSyncing ? '#ffedd5' : '#dcfce7'}`, fontWeight: 'bold'
        }}>
          {isSyncing ? '🔄 同期中...' : '✅ 同期済み'}
        </span>
      </h1>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={() => syncToCloud()} disabled={isSyncing}>🔄 同期</button>
        <button className="btn btn-primary" onClick={onAddEnterprise}>+ 企業登録</button>
        <button className="btn btn-ghost" onClick={logout}>ログアウト</button>
      </div>
    </div>
  );
};
