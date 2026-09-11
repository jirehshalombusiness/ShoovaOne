import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '@/services/auth.service';
import { User } from '@/types/user.types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Normalize user object — ensures `roles` and `permissions`
 * are ALWAYS arrays, even when the API omits them.
 */
function normalizeUser(raw: any): User | null {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    first_name: raw.first_name ?? '',
    last_name: raw.last_name ?? '',
    is_active: raw.is_active ?? true,
    created_at: raw.created_at ?? new Date().toISOString(),
    last_login_at: raw.last_login_at ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');

      if (!token) {
        setLoading(false);
        return;
      }

      // 1. Try cached user first (fast render)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser(normalizeUser(parsed));
        } catch {
          localStorage.removeItem('user');
        }
      }

      // 2. Refresh from API (authoritative)
      try {
        const fresh = await authService.getCurrentUser();
        const normalized = normalizeUser(fresh);
        setUser(normalized);
        if (normalized) {
          localStorage.setItem('user', JSON.stringify(normalized));
        }
      } catch (error) {
        console.error('Failed to refresh user:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setUser(null);
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    const normalized = normalizeUser(response.user);
    setUser(normalized);
    if (normalized) {
      localStorage.setItem('user', JSON.stringify(normalized));
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.log('Logout error:', error);
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}