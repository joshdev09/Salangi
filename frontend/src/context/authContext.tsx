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

    // ── Listen for ALL auth state changes including token refresh ────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // TOKEN_REFRESHED fires automatically when Supabase silently refreshes
      // the access token — update our session state so ProtectedRoute always
      // has a valid, non-expired token
      if (
        _event === 'SIGNED_IN' ||
        _event === 'TOKEN_REFRESHED' ||
        _event === 'USER_UPDATED'
      ) {
        setSession(session);
        if (session?.user?.id) {
          fetchRole(session.user.id);
          if (_event === 'SIGNED_IN') startPolling();
        }
      } else if (_event === 'SIGNED_OUT') {
        setSession(null);
        setRole(null);
        localStorage.removeItem('session_token');
        stopPolling();
      }
    });

    // ── Refresh token when tab becomes visible again after being hidden ───────
    // This covers the case where the device was asleep or the tab was in the
    // background — the token may have expired while the JS event loop was paused
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session } } = await supabase.auth.getSession();
        // getSession() triggers a silent token refresh if the token is expired
        // but the refresh token is still valid — so just sync state
        setSession(session);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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