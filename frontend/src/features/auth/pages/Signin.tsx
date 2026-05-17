import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { ROUTES } from '../../../routes/paths';

//bg
import bg from '@assets/images/bg.png';

//icons
import salangiLogo from '@assets/png-files/salangi-logo.png'

function Signin() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({ email, password });
      if (supabaseError) throw supabaseError;

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        setError('Please verify your email before signing in. Check your inbox.');
        return;
      }

      // Register session on backend — invalidates any concurrent sessions
      try {
        const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
        const res = await axios.post(
          `${apiUrl}/api/auth/session-login`,
          {},
          { headers: { Authorization: `Bearer ${data.session!.access_token}` } }
        );
        localStorage.setItem('session_token', res.data.session_token);
      } catch (sessionErr) {
        console.warn('Session registration failed:', sessionErr);
      }

      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', data.user.id)
        .single();

      if (userData?.is_admin) {
        navigate(ROUTES.ADMIN_DASHBOARD);
        return;
      }

      const meta = data.user.user_metadata;
      localStorage.setItem('user', JSON.stringify({
        user_id:     data.user.id,
        first_name:  meta?.first_name ?? meta?.full_name?.split(' ')[0] ?? '',
        last_name:   meta?.last_name  ?? meta?.full_name?.split(' ')[1] ?? '',
        email:       data.user.email,
        profile_pic: meta?.avatar_url ?? null,
      }));

      navigate('/home-page');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center lg:justify-start overflow-x-hidden overflow-y-auto bg-[#222222]">
      {/* Background Image - Desktop Only */}
      <div 
        className="absolute inset-0 hidden lg:block bg-cover bg-center opacity-100"
        style={{ backgroundImage: `url(${bg})` }}
      />
      
      {/* Dynamic gradient for desktop */}
      <div 
        className="absolute inset-0 hidden lg:block"
        style={{
          backgroundImage: `linear-gradient(to right, transparent -11%, rgba(34, 34, 34, 0.9) 30%, #222222 50%)`,
        }}
      />

      {/* Dashed curve decoration */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none hidden md:block" preserveAspectRatio="none">
        <path
          d="M 400 0 C 200 200, 600 400, 400 800"
          transform="translate(200, 0)"
          fill="none"
          stroke="white"
          strokeWidth="1"
          strokeDasharray="8 8"
          className="opacity-20"
        />
      </svg>

      {/* Header with Actions and Logo on the right */}
      <div className="absolute top-0 left-0 right-0 px-4 lg:px-8 py-6 flex items-center justify-end gap-4 lg:gap-6 z-50">
        
        <img src={salangiLogo} alt="Salangi Logo" className="w-10 h-10 lg:w-16 lg:h-16 shrink-0" />
      </div>

      {/* Brighter concentrated top glow for all screen sizes */}
      <div className="absolute top-0 left-0 right-0 h-80 lg:h-[500px] bg-radial from-[#FFE2A0]/60 via-transparent to-transparent blur-3xl opacity-100 lg:opacity-70 pointer-events-none -translate-y-1/2" />

      <div className="w-full relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-16 grid grid-cols-1 lg:grid-cols-2 min-h-screen gap-12 lg:gap-20">
          
          {/* Left Side — Headline (Desktop Only) */}
          <div className="hidden lg:flex flex-col justify-end pb-24 xl:pb-32 motion-preset-slide-right motion-duration-800">
            <h1 className="font-['Playfair_Display'] text-[60px] xl:text-[80px] font-bold text-[#FBFAF8] leading-tight max-w-xl">
              Continue your Pampanga <span className="text-[#FFE2A0]">Journey</span>
            </h1>
          </div>

          {/* Right Side — Form */}
          <div className="w-full max-w-md mx-auto lg:ml-auto flex flex-col justify-center py-24 lg:py-0 motion-preset-slide-left motion-duration-800">
            
            {/* Heading */}
            <div className="mb-6 lg:mb-10 text-left pt-6 lg:pt-0">
              <h1 className="font-['Playfair_Display'] text-[#FBFAF8] text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
                Sign in<span className="text-[#FFE2A0]">.</span>
              </h1>
              <p className="text-[#FBFAF8]/70 text-xs sm:text-sm lg:text-base">Continue exploring local businesses and experiences.</p>
            </div>

            <div className="space-y-6">
              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="text-[#FBFAF8] text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  placeholder="juan.dc@gmail.com"
                  className="bg-[#2E2E2E]/80 text-white placeholder-gray-500 px-4 py-3.5 rounded-xl border border-white/5 focus:ring-1 focus:ring-[#FFE2A0] outline-none transition-all w-full"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[#FBFAF8] text-sm font-medium">Password</label>
                  <Link to="/forgot-password" title="Forgot password" className="text-[#FFE2A0] text-xs hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                    placeholder="**********"
                    className="w-full bg-[#2E2E2E]/80 text-white placeholder-gray-500 px-4 py-3.5 rounded-xl border border-white/5 focus:ring-1 focus:ring-[#FFE2A0] outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Status Messages */}
                {error && (
                  <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    <p className="text-red-400 text-xs leading-normal">{error}</p>
                  </div>
                )}
              </div>

              {/* Action Section */}
              <div className="pt-4 space-y-6">
                <button
                  onClick={handleSignIn}
                  disabled={loading}
                  className="w-full py-4 bg-[#FFE2A0] hover:bg-[#fcd789] active:bg-[#f5cc70] rounded-xl cursor-pointer font-bold text-[#222222] text-base transition-all shadow-lg shadow-amber-950/20 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[#FBFAF8]/30 text-xs">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  type="button"
                  className="w-full py-3.5 bg-[#2E2E2E]/80 hover:bg-[#3a3a3a] border border-white/10 rounded-xl cursor-pointer font-semibold text-[#FBFAF8] text-sm transition-all flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.7 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.7 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.5 35.7 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
                  Continue with Google
                </button>

                <p className="text-[#FBFAF8]/60 text-left text-sm">
                  Don't have an account?{' '}
                  <Link to="/sign-up">
                    <span className="text-[#FFE2A0] font-semibold cursor-pointer hover:underline">Sign up</span>
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signin;