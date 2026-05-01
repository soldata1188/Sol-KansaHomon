import React from 'react';

interface LoginFormProps {
  password:  string;
  setPassword: (val: string) => void;
  loginError: boolean;
  handleLogin: (e: React.FormEvent) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ password, setPassword, loginError, handleLogin }) => {
  const inputStyle = { width: '100%', padding: '0.6rem', border: '1px solid var(--card-border)', borderRadius: '4px', boxSizing: 'border-box' as const };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <form onSubmit={handleLogin} className="card card-modal" style={{ width: '380px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ソリューション協同組合</p>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', margin: 0 }}>監査訪問管理システム</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>パスワードを入力してください</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={inputStyle} autoFocus required />
          </div>
          {loginError && <p style={{ color: 'var(--status-red)', fontSize: '0.8rem', margin: 0 }}>パスワードが正しくありません。</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>アクセス</button>
        </div>
      </form>
    </div>
  );
};
