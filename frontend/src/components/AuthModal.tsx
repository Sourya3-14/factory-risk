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
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">
            <span>YantraWatch Access Control</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem' }}>
          {/* Quick Demo Switcher */}
          <div className="demo-login-box">
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
              ⚡ 1-Click Demo Accounts (Instant Role Switch)
            </div>
            <div className="demo-accounts-grid">
              <button
                type="button"
                className="demo-account-btn"
                onClick={() => handleDemoLogin('engineer@yantrawatch.com')}
                disabled={isLoading}
              >
                <span style={{ fontSize: '1.1rem' }}>🔧</span>
                <strong style={{ fontSize: '0.75rem', color: '#fff' }}>Ramesh</strong>
                <span className="demo-role-tag badge-engineer">Engineer</span>
              </button>
              <button
                type="button"
                className="demo-account-btn"
                onClick={() => handleDemoLogin('supervisor@yantrawatch.com')}
                disabled={isLoading}
              >
                <span style={{ fontSize: '1.1rem' }}>📋</span>
                <strong style={{ fontSize: '0.75rem', color: '#fff' }}>Rajesh</strong>
                <span className="demo-role-tag badge-supervisor">Supervisor</span>
              </button>
              <button
                type="button"
                className="demo-account-btn"
                onClick={() => handleDemoLogin('owner@yantrawatch.com')}
                disabled={isLoading}
              >
                <span style={{ fontSize: '1.1rem' }}>🏛️</span>
                <strong style={{ fontSize: '0.75rem', color: '#fff' }}>Vikram</strong>
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

          {error && (
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: 4, marginTop: '0.5rem' }}>
              {error}
            </div>
          )}

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
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="ctrl-btn play-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', marginTop: '0.5rem' }}
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In to Console'}
              </button>
            </form>
          ) : (
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
                  placeholder="anil@factory.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password (min 6 characters)</label>
                <input
                  type="password"
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
                  placeholder="e.g. Pune Precision Gears"
                  value={factoryName}
                  onChange={(e) => setFactoryName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="complete-btn"
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem' }}
                disabled={isLoading}
              >
                {isLoading ? 'Registering...' : 'Register Factory User'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
