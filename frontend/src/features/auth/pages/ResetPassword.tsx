import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import bg from '@assets/images/bg.png';
import { supabase } from '@/lib/supabase';

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase JS v2 uses PKCE flow by default. The reset link contains a
    // ?code= query param (not a #access_token hash). Supabase automatically
    // exchanges the code for a session and fires PASSWORD_RECOVERY.
    // Do NOT call signOut() here — that kills the session before the user
    // can update their password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Valid recovery session established — user can now set a new password
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const validatePassword = (pw: string): string => {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(pw)) return 'Password must include at least one lowercase letter.';
    if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter.';
    if (!/[0-9]/.test(pw)) return 'Password must include at least one number.';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw)) return 'Password must include at least one special character.';
    return '';
  };

  const handleResetPassword = async () => {
    setError('');
    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    setLoading(true);
    try {
      const { error: supabaseError } = await supabase.auth.updateUser({ password });
      if (supabaseError) throw supabaseError;
      // Sign out after successful password reset so user must log in fresh
      await supabase.auth.signOut();
      setSuccess(true);
      setTimeout(() => navigate('/sign-in'), 3000);
    } catch (err: any) {
      setError(err.message?.charAt(0).toUpperCase() + err.message?.slice(1) || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center lg:justify-start overflow-x-hidden overflow-y-auto bg-[#222222]">
      {/* Background Image — desktop only */}
      <div
        className="absolute inset-0 hidden lg:block bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Gradient overlay — desktop only */}
      <div
        className="absolute inset-0 hidden lg:block"
        style={{
          backgroundImage: `linear-gradient(to right, transparent -11%, rgba(34, 34, 34, 0.9) 30%, #222222 50%)`,
        }}
      />

      {/* Dashed curve decoration — hidden on mobile */}
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

      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-80 lg:h-[500px] bg-radial from-[#FFE2A0]/60 via-transparent to-transparent blur-3xl opacity-100 lg:opacity-70 pointer-events-none -translate-y-1/2" />

      <div className="w-full relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-16 grid grid-cols-1 lg:grid-cols-2 min-h-screen gap-12 lg:gap-20">

          {/* Left Side — Headline (desktop only) */}
          <div className="hidden lg:flex flex-col justify-end pb-24 xl:pb-32 motion-preset-slide-right motion-duration-800">
            <h1 className="font-['Playfair_Display'] text-[60px] xl:text-[80px] font-bold text-[#FBFAF8] leading-tight max-w-xl">
              Set a New <br />
              <span className="text-[#FFE2A0]">Password</span>
            </h1>
          </div>

          {/* Right Side — Form */}
          <div className="w-full max-w-lg mx-auto lg:ml-auto flex flex-col justify-center py-20 lg:py-0 motion-preset-slide-left motion-duration-800">
            {success ? (
              <div className="text-left motion-preset-fade">
                <div className="text-5xl mb-6">✅</div>
                <h2 className="font-['Playfair_Display'] text-white text-3xl sm:text-4xl font-bold mb-3">
                  Password Updated!
                </h2>
                <p className="text-[#FBFAF8]/70 text-sm lg:text-base">
                  Redirecting you to sign in...
                </p>
              </div>
            ) : (
              <div>
                {/* Heading */}
                <div className="mb-8 text-left">
                  <h1 className="font-['Playfair_Display'] text-[#FBFAF8] text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
                    New password<span className="text-[#FFE2A0]">.</span>
                  </h1>
                  <p className="text-[#FBFAF8]/70 text-xs sm:text-sm lg:text-base">
                    Choose a strong password for your account.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label className="text-[#FBFAF8]/70 text-xs sm:text-sm mb-2 block font-medium">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full bg-[#1A1A1A] border-2 border-[#373737] text-white placeholder-[#FBFAF8]/20 px-4 sm:px-5 py-3 sm:py-4 rounded-xl outline-none focus:border-[#FFE2A0]/50 transition-all text-sm sm:text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="text-[#FBFAF8]/70 text-xs sm:text-sm mb-2 block font-medium">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                        placeholder="Repeat new password"
                        className="w-full bg-[#1A1A1A] border-2 border-[#373737] text-white placeholder-[#FBFAF8]/20 px-4 sm:px-5 py-3 sm:py-4 rounded-xl outline-none focus:border-[#FFE2A0]/50 transition-all text-sm sm:text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      <span className="text-red-400 text-sm">⚠</span>
                      <p className="text-red-400 text-xs leading-snug">
                        {error.charAt(0).toUpperCase() + error.slice(1)}
                      </p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleResetPassword}
                    disabled={loading || !password || !confirmPassword}
                    className="w-full bg-[#FFE2A0] hover:bg-[#fcd789] active:bg-[#f5cc70] text-[#222222] font-bold py-3 sm:py-4 rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-[#FFE2A0]/10 mt-2 active:scale-[0.98] text-sm sm:text-base"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default ResetPassword;