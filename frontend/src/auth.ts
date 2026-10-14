/**
 * YantraWatch Auth Module
 * Connects directly to FastAPI backend with Neon PostgreSQL
 */

export type UserRole = 'maintenance_engineer' | 'supervisor' | 'factory_owner';

export interface User {
  id: string | number;
  name: string;
  email: string;
  role: UserRole;
  factory_name?: string;
  phone_number?: string;
  permissions?: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  factory_name?: string;
  phone_number?: string;
}

const TOKEN_KEY = 'yw_auth_token';
const USER_KEY = 'yw_auth_user';

type AuthListener = (state: AuthState) => void;
const listeners = new Set<AuthListener>();

let currentAuthState: AuthState = {
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,
};

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function notifyListeners() {
  listeners.forEach(fn => fn(currentAuthState));
}

export function getAuthToken(): string | null {
  return currentAuthState.token || getStoredToken();
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  currentAuthState = {
    ...currentAuthState,
    token,
    isAuthenticated: !!token,
  };
  notifyListeners();
}

export function getCurrentUser(): User | null {
  return currentAuthState.user || getStoredUser();
}

export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
  currentAuthState = {
    ...currentAuthState,
    user,
    isAuthenticated: !!currentAuthState.token && !!user,
  };
  notifyListeners();
}

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(currentAuthState);
  return () => {
    listeners.delete(listener);
  };
}

export function isAuthenticated(): boolean {
  return currentAuthState.isAuthenticated;
}

/**
 * Login user via backend API
 */
export async function login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed');
  }

  const user: User = {
    id: data.user.id,
    name: data.user.full_name,
    email: data.user.email,
    role: data.user.role as UserRole,
    factory_name: data.user.factory_name,
    phone_number: data.user.phone_number,
  };

  setAuthToken(data.access_token);
  setCurrentUser(user);

  return { user, token: data.access_token };
}

/**
 * Signup user via backend API
 */
export async function signup(credentials: SignupCredentials): Promise<{ user: User; token: string }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      full_name: credentials.name,
      role: credentials.role,
      factory_name: credentials.factory_name || 'Yantra Manufacturing Unit 1',
      phone_number: credentials.phone_number,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Signup failed');
  }

  const user: User = {
    id: data.user.id,
    name: data.user.full_name,
    email: data.user.email,
    role: data.user.role as UserRole,
    factory_name: data.user.factory_name,
    phone_number: data.user.phone_number,
  };

  setAuthToken(data.access_token);
  setCurrentUser(user);

  return { user, token: data.access_token };
}

/**
 * Fetch current user profile with role permissions
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      logout();
      return null;
    }
    const data = await res.json();
    const user: User = {
      id: data.id,
      name: data.full_name,
      email: data.email,
      role: data.role as UserRole,
      factory_name: data.factory_name,
      permissions: data.permissions,
    };
    setCurrentUser(user);
    return user;
  } catch {
    return null;
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  setAuthToken(null);
  setCurrentUser(null);
}
