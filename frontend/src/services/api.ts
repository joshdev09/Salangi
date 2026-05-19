import { supabase } from '@/lib/supabase';

// -- Authentication (Supabase) ------------------------------------------------
export async function registerUser(data: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        first_name: data.first_name,
        last_name: data.last_name,
        role: 'business',
      },
    },
  });
  if (error) throw new Error(error.message);
  return {
    message: 'Account created! Please check your email to verify your account before signing in.',
    user: authData.user,
  };
}

// -- Check if email already exists in public.users ----------------------------
export async function checkEmailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

if (import.meta.env.DEV) {
  console.log('API Base URL:', BASE_URL, 'Mode:', import.meta.env.MODE);
}

// -- Get live Supabase session token ------------------------------------------
async function getToken(): Promise<string> {
  // refreshSession() hits the network and restores the token even when
  // localStorage is stale (e.g. www. vs non-www origin mismatch).
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData.session?.access_token) {
    return refreshData.session.access_token;
  }
  // Fallback: read existing session as-is
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.');
  }
  return data.session.access_token;
}

// -- Shared fetch helper -------------------------------------------------------
export async function authFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  let sessionToken = localStorage.getItem('session_token');

  if (!BASE_URL) {
    throw new Error('API URL is not configured. Please set VITE_API_URL in your .env file.');
  }

  const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

  // If no session_token (e.g. Google OAuth users), register one automatically
  if (!sessionToken) {
    try {
      const regRes = await fetch(`${baseUrl}/api/auth/session-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (regRes.ok) {
        const regData = await regRes.json();
        sessionToken = regData.session_token;
        localStorage.setItem('session_token', sessionToken!);
      }
    } catch (e) {
      console.warn('Auto session registration failed:', e);
    }
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(sessionToken ? { 'x-session-token': sessionToken } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const message = typeof detail === "string" ? detail : typeof detail === "object" && detail !== null ? JSON.stringify(detail) : `Request failed (${res.status})`;
    throw new Error(message);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// -- Profile (backend) ---------------------------------------------------------
export async function updateProfile(data: {
  first_name?: string;
  last_name?: string;
  email?: string;
}) {
  return authFetch('/api/auth/update-profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// -- Password (Supabase directly) ----------------------------------------------
export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return { message: 'Password updated successfully.' };
}

// -- Delete account ------------------------------------------------------------
export async function deleteAccount() {
  return authFetch('/api/auth/delete-account', { method: 'DELETE' });
}

// -- Upgrade to business -------------------------------------------------------
export async function upgradeToBusinessAccount(): Promise<void> {
  await authFetch('/api/auth/upgrade-to-business', { method: 'POST' });
}