import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'business' | null;

interface AuthContextValue {
  session: Session | null;
  role: Role;
  loading: boolean;
  /** Directly set the role in context (use refreshRole instead when possible) */
  setRole: (role: Role) => void;
  /** Re-fetches role from DB and updates context — use this after upgrade */
  refreshRole: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  session: null,
  role: null,
  loading: true,
  setRole: () => {},
  refreshRole: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch role from DB for a given userId ──────────────────────────────────
  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error) console.error('Error refreshing user profile:', error);
    setRole((data?.role as Role) ?? 'user');
  };

  // ── Public: re-fetch role using current session ────────────────────────────
  // Call this after upgradeToBusinessAccount() so the context is always
  // sourced from the DB — avoids the race between manual setRole() and
  // onAuthStateChange firing fetchRole() and overwriting it.
  const refreshRole = async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    if (currentSession?.user?.id) {
      await fetchRole(currentSession.user.id);
    }
  };

  useEffect(() => {
    // ── Initial session load ─────────────────────────────────────────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchRole(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // ── Listen for auth state changes (login, logout, token refresh) ─────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, role, loading, setRole, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}