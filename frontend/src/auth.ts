/**
 * YantraWatch Auth Module
 * Handles token storage, auth state, and stubs for upcoming signup/login functionality.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OPERATOR' | 'MAINTENANCE_MANAGER' | 'PLANT_HEAD' | 'ADMIN';
  plantId?: string;
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
  role?: string;
  plantId?: string;
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

/**
 * Retrieve current active token for API request headers
 */
export function getAuthToken(): string | null {
  return currentAuthState.token || getStoredToken();
}

/**
 * Store and apply active JWT / session token
 */
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

/**
 * Retrieve current user profile
 */
export function getCurrentUser(): User | null {
  return currentAuthState.user || getStoredUser();
}

/**
 * Store and apply current user profile
 */
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

/**
 * Subscribe to authentication state changes
 */
export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(currentAuthState);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Check if current session is authenticated
 */
export function isAuthenticated(): boolean {
  return currentAuthState.isAuthenticated;
}

/* =========================================================================
   Placeholder stubs ready for future Signup / Login implementation
   ========================================================================= */

/**
 * Login user (Stub for future API integration)
 */
export async function login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
  // TODO: Replace with real POST /api/auth/login call when backend endpoints are wired
  console.log('[Auth] Login requested with:', credentials.email);
  
  // Simulated success structure for quick testing
  const dummyUser: User = {
    id: 'usr_admin_01',
    name: 'Shift Supervisor',
    email: credentials.email,
    role: 'PLANT_HEAD',
  };
  const dummyToken = 'jwt_simulated_token_' + Date.now();

  setAuthToken(dummyToken);
  setCurrentUser(dummyUser);

  return { user: dummyUser, token: dummyToken };
}

/**
 * Signup user (Stub for future API integration)
 */
export async function signup(credentials: SignupCredentials): Promise<{ user: User; token: string }> {
  // TODO: Replace with real POST /api/auth/signup call when backend endpoints are wired
  console.log('[Auth] Signup requested for:', credentials.email);

  const newUser: User = {
    id: 'usr_' + Date.now(),
    name: credentials.name,
    email: credentials.email,
    role: (credentials.role as User['role']) || 'OPERATOR',
    plantId: credentials.plantId || 'PLANT_PUNE_01',
  };
  const token = 'jwt_simulated_token_' + Date.now();

  setAuthToken(token);
  setCurrentUser(newUser);

  return { user: newUser, token };
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  // TODO: Call POST /api/auth/logout if session invalidation is needed
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentAuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  };
  notifyListeners();
}
