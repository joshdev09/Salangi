import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const refreshRole = async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    if (currentSession?.user?.id) {
      await fetchRole(currentSession.user.id);
    }
  };

  // ── Polling controls ───────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const forceSignOut = async () => {
    stopPolling();
    localStorage.removeItem('session_token');
    await supabase.auth.signOut();
    alert("You've been signed out because your account was logged in from another device.");
  };

  const checkSession = async () => {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) return;

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) return;

    try {
      await axios.post(
        `${API_BASE}/api/auth/ping-session`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
            'x-session-token': sessionToken,
          },
        }
      );
    } catch (err: any) {
      if (
        err?.response?.status === 401 &&
        err?.response?.data?.detail?.includes('logged in from another device')
      ) {
        await forceSignOut();
      }
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(checkSession, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    // ── Initial session load ─────────────────────────────────────────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchRole(session.user.id).finally(() => setLoading(false));
        if (localStorage.getItem('session_token')) startPolling();
      } else {
        setLoading(false);
      }
    });

    // ── Listen for auth state changes ────────────────────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchRole(session.user.id);
        if (_event === 'SIGNED_IN') startPolling();
      } else {
        setRole(null);
        localStorage.removeItem('session_token');
        stopPolling();
      }
    });

    return () => {
      subscription.unsubscribe();
      stopPolling();
    };
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