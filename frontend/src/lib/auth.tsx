import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authService } from '@/services/auth.service';
import { User } from '@/types/user.types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(raw: any): User | null {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    first_name: raw.first_name ?? '',
    last_name: raw.last_name ?? '',
    profile_image_url: raw.profile_image_url ?? null,
    job_title: raw.job_title ?? null,
    is_active: raw.is_active ?? true,
    must_change_password: raw.must_change_password ?? false,
    created_at: raw.created_at ?? new Date().toISOString(),
    last_login_at: raw.last_login_at ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard: prevent the boot effect from clobbering a fresh login
  const bootAbortedRef = useRef(false);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // 1. Optimistic cached user
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          // Only apply if we haven't been aborted by a fresh login
          if (!bootAbortedRef.current) {
            setUser(normalizeUser(parsed));
          }
        } catch {
          localStorage.removeItem('user');
        }
      }

      // 2. Authoritative refresh
      try {
        const fresh = await authService.getCurrentUser();

        // If a login happened while we were fetching, drop this result.
        if (bootAbortedRef.current) {
          return;
        }

        const normalized = normalizeUser(fresh);
        setUser(normalized);
        if (normalized) {
          localStorage.setItem('user', JSON.stringify(normalized));
        }
      } catch (error) {
        // If a login happened, don't wipe the fresh token.
        if (bootAbortedRef.current) {
          return;
        }
        console.error('Failed to refresh user:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        if (!bootAbortedRef.current) {
          setLoading(false);
        }
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    // Mark boot as aborted — prevents race with the useEffect above
    bootAbortedRef.current = true;

    const response = await authService.login(email, password);
    const normalized = normalizeUser(response.user);
    setUser(normalized);

    if (normalized) {
      localStorage.setItem('user', JSON.stringify(normalized));
      return normalized;
    }

    throw new Error('Unable to load user information');
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const updatedUser = { ...current, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.log('Logout error:', error);
    }
    bootAbortedRef.current = false; // reset for next login
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
        updateUser,
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