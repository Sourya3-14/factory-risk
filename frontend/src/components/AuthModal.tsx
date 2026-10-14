import React, { useState } from 'react';
import { login, signup, type UserRole } from '../auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('maintenance_engineer');
  const [factoryName, setFactoryName] = useState('Yantra Manufacturing Unit 1');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleDemoLogin = async (demoEmail: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await login({ email: demoEmail, password: 'password123' });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login({ email, password });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signup({
        name,
        email,
        password,
        role,
        factory_name: factoryName,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 470 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <div className="brand-icon" style={{ width: 32, height: 32, fontSize: '0.9rem' }}>YW</div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                Factory Access Console
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                Role-Based Sentinel Authentication
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem' }}>
          {/* Quick Demo Switcher */}
          <div className="demo-login-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⚡ 1-Click Role Switch (Demo Mode)
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Instant Auth</span>
            </div>
            
            <div className="demo-accounts-grid">
              <button
                type="button"
                className="demo-account-btn"
                onClick={() => handleDemoLogin('engineer@yantrawatch.com')}
                disabled={isLoading}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🔧</span>
                <strong style={{ fontSize: '0.78rem', color: '#fff' }}>Ramesh</strong>
                <span className="demo-role-tag badge-engineer">Engineer</span>
              </button>

              <button
                type="button"
                className="demo-account-btn"
                onClick={() => handleDemoLogin('supervisor@yantrawatch.com')}
                disabled={isLoading}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>📋</span>
                <strong style={{ fontSize: '0.78rem', color: '#fff' }}>Rajesh</strong>
                <span className="demo-role-tag badge-supervisor">Supervisor</span>
              </button>

              <button
                type="button"
                className="demo-account-btn"
                onClick={() => handleDemoLogin('owner@yantrawatch.com')}
                disabled={isLoading}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🏛️</span>
                <strong style={{ fontSize: '0.78rem', color: '#fff' }}>Vikram</strong>
                <span className="demo-role-tag badge-owner">Owner</span>
              </button>
            </div>
          </div>

          {/* Sign In vs Sign Up Tabs */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'signin' ? 'active' : ''}`}
              onClick={() => { setTab('signin'); setError(null); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => { setTab('signup'); setError(null); }}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--accent-rose)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.5rem'
            }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Sign In Form */}
          {tab === 'signin' ? (
            <form onSubmit={handleSignInSubmit} className="auth-form-card" style={{ marginTop: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="supervisor@yantrawatch.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Factory Console</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Sign Up Form */
            <form onSubmit={handleSignUpSubmit} className="auth-form-card" style={{ marginTop: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Anil Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="anil.k@factory.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Password (min 6 chars)</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Factory Role</label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="maintenance_engineer">🔧 Maintenance Engineer (Floor technician)</option>
                  <option value="supervisor">📋 Shift Supervisor (Task & SLA manager)</option>
                  <option value="factory_owner">🏛️ Factory Owner (Executive & ₹ risk owner)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Factory / Unit Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Pune Precision Gears Unit-1"
                  value={factoryName}
                  onChange={(e) => setFactoryName(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Register Factory Account</span>
                    <span>✔</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
