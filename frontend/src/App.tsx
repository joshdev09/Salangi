import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { ROUTES } from './routes/paths';
import { AuthProvider, useAuth } from './context/authContext';

// Auth & Protected Components
import ProtectedRoute from './routes/ProtectedRoute';

// Feature Components - Business Side
import Dashboard from './features/business-side/pages/Dashboard'
import Overview from './features/business-side/components/Overview'
import MyBusiness from './features/business-side/components/MyBusiness'
import Events from './features/business-side/components/Events'
import Reviews from './features/business-side/components/Reviews'
import Analytics from './features/business-side/components/Analytics'
import Gallery from './features/business-side/components/Gallery'
import Settings from './features/business-side/components/Settings'

// Feature Components - Main Side
import Navigator from './features/Navigator'
import Homepage from './features/dashboard/pages/Homepage'
import EventsPage from './features/dashboard/pages/EventsPage'
import Locationpage from './features/dashboard/pages/Locationpage'
import Savepage from './features/dashboard/pages/Savepage'
import MapView from './map/MapView'
import ListingSlugRedirect from './features/dashboard/pages/ListingSlugRedirect'

import Signin from './features/auth/pages/Signin'
import Register from './features/auth/pages/Register'
import ForgotPassword from './features/auth/pages/ForgotPassword'
import ResetPassword from './features/auth/pages/ResetPassword'
import BusinessRegister from './features/auth/pages/BusinessRegister'
import BusinessSignin from './features/auth/pages/BusinessSignin'
import HeroListBusiness from './features/dashboard/pages/HeroListBusiness'
import ListBusiness from './features/business-side/components/ListBusiness'
import EmailConfirmed from './features/auth/pages/EmailConfirmed'
import UpgradeToBusinessPage from './features/business-side/pages/UpgradeToBusinessPage'
import SalangiSkeleton from "./components/SalangiSkeleton";

// Feature Components - Admin Side
import AdminDashboard from './features/admin/pages/AdminDashboard'

// ─── Auth Callback ────────────────────────────────────────────────────────────

function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/sign-in"); return; }

      // Ensure profiles row exists for Google OAuth new users
      await supabase.from("profiles").upsert(
        { id: session.user.id, role: "user" },
        { onConflict: "id", ignoreDuplicates: true }
      );

      // Register session on backend so x-session-token is set in localStorage
      // (required by update-profile and other protected endpoints)
      try {
        const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
        const res = await fetch(`${apiUrl}/api/auth/session-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("session_token", data.session_token);
        }
      } catch (e) {
        console.warn("Session registration failed:", e);
      }

      navigate("/home-page");
    })
  }, [navigate]);
  return <div className="min-h-screen bg-[#111111] flex items-center justify-center text-white">Loading...</div>
}

// ─── Admin redirect helper ────────────────────────────────────────────────────

function AdminRedirectOrHome({ session }: { session: Session }) {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('users')
      .select('is_admin')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setTarget(data?.is_admin ? ROUTES.ADMIN_DASHBOARD : ROUTES.HOME);
      });
  }, [session]);

  if (!target) return null;
  return <Navigate to={target} replace />;
}

// ─── Inner app — has access to AuthContext ────────────────────────────────────

function AppRoutes() {
  const { session, role, loading } = useAuth();

  if (loading) {
  return <SalangiSkeleton />;
}

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Email confirmation — public */}
      <Route path="/email-confirmed" element={<EmailConfirmed />} />

      {/* Auth routes — redirect if already logged in */}
      <Route path="/sign-up" element={session ? <AdminRedirectOrHome session={session} /> : <Register />} />
      <Route path={ROUTES.SIGN_IN} element={session ? <AdminRedirectOrHome session={session} /> : <Signin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Upgrade to business — public but needs session inside */}
      <Route path={ROUTES.UPGRADE_TO_BUSINESS} element={<UpgradeToBusinessPage />} />

      {/* Admin routes */}
      <Route path={ROUTES.ADMIN} element={<Navigate to={ROUTES.SIGN_IN} replace />} />
      <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboard />} />

      {/* Business Side Public Routes */}
      <Route path={ROUTES.LIST_YOUR_BUSINESS} element={<HeroListBusiness />} />
      <Route path={ROUTES.BUSINESS_REGISTER} element={<BusinessRegister />} />
      <Route path={ROUTES.BUSINESS_SIGNIN} element={<BusinessSignin />} />
      <Route path={ROUTES.LIST_BUSINESS} element={<ListBusiness />} />

      {/* Business Side Dashboard — requires business role */}
      <Route
        path={ROUTES.DASHBOARD}
        element={
          <ProtectedRoute
            session={session}
            role={role}
            redirectPath={ROUTES.SIGN_IN}
            requireBusiness
          >
            <Dashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={ROUTES.DASHBOARD_OVERVIEW} replace />} />
        <Route path={ROUTES.DASHBOARD_REL.OVERVIEW}     element={<Overview />}    />
        <Route path={ROUTES.DASHBOARD_REL.MY_BUSINESS}  element={<MyBusiness />}  />
        <Route path={ROUTES.DASHBOARD_REL.EVENTS}       element={<Events />}      />
        <Route path={ROUTES.DASHBOARD_REL.REVIEWS}      element={<Reviews />}     />
        <Route path={ROUTES.DASHBOARD_REL.ANALYTICS}    element={<Analytics />}   />
        <Route path={ROUTES.DASHBOARD_REL.GALLERY}      element={<Gallery />}     />
        <Route path={ROUTES.DASHBOARD_REL.SETTINGS}     element={<Settings />}    />
      </Route>

      {/* Main Application Layout — accessible to guests */}
      <Route
        path="/"
        element={<Navigator />}
      >
        <Route index element={<Navigate to={ROUTES.HOME} replace />} />
        <Route path={ROUTES.HOME}        element={<Homepage />}      />
        <Route path={ROUTES.EVENTS_PAGE} element={<EventsPage />}    />
        <Route path={ROUTES.LOCATION}    element={<Locationpage />}  />
        <Route path={ROUTES.SAVE}        element={<Savepage />}      />
        <Route path={ROUTES.MAP}         element={<MapView />}       />
        <Route path="/listing/:slug"     element={<ListingSlugRedirect />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}

// ─── Root App — wraps everything in AuthProvider ──────────────────────────────

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;