import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;
const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

const API = axios.create({
  baseURL: baseUrl,
});

// ── Attach session token to every request ─────────────────────────────────────
API.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem('session_token');
  if (sessionToken) {
    config.headers['x-session-token'] = sessionToken;
  }
  return config;
});

// ── Force logout + toast when session is invalidated by a new login elsewhere ─
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 401 &&
      error.response?.data?.detail === "Session expired. You've been logged in from another device."
    ) {
      localStorage.removeItem('session_token');
      // Dynamic import avoids circular deps with authContext
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      await supabase.auth.signOut();
      // Show a toast — works with any toast lib; falls back to alert
      if (typeof window !== 'undefined') {
        const msg = "You've been signed out because your account was logged in from another device.";
        if ((window as any).__toast) {
          (window as any).__toast(msg);
        } else {
          alert(msg);
        }
      }
    }
    return Promise.reject(error);
  }
);

export const registerUser = async (data: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) => {
  const response = await API.post("/api/auth/register", data);
  return response.data;
};

export const loginUser = async (data: {
  email: string;
  password: string;
}) => {
  const response = await API.post("/api/auth/login", data);
  return response.data;
};