import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Check, AlertCircle, Loader2, Camera, Eye, EyeOff, Trash2, ShieldAlert, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { updateProfile, changePassword, deleteAccount, upgradeToBusinessAccount } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/authContext';

interface SettingsPageProps {
  onClose: () => void;
  scrollTo?: 'upgrade' | null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return createPortal(
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300 whitespace-nowrap ${
      type === 'success' ? 'bg-[#FFE2A0] text-[#1A1A1A]' : 'bg-red-500 text-white'
    }`}>
      {type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
      {message}
    </div>,
    document.body
  );
}

// ─── Section Title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold mb-5 uppercase tracking-[0.15em] text-zinc-500">
      {children}
    </h3>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────

function InputField({
  label, type = 'text', value, onChange, placeholder, rightElement,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <div className="relative flex items-center">
        <input
          type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#1C1C1C] border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-[#FBFAF8] placeholder-zinc-600 outline-none focus:border-[#FFE2A0]/60 focus:ring-1 focus:ring-[#FFE2A0]/20 transition-all pr-10"
        />
        {rightElement && <div className="absolute right-3 text-zinc-500">{rightElement}</div>}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

const SettingsPage = ({ onClose, scrollTo }: SettingsPageProps) => {
  const navigate = useNavigate();

  // Pull role + refreshRole from AuthContext
  // refreshRole re-fetches from DB — safer than manually calling setRole,
  // because it wins the race against onAuthStateChange re-fetching stale data.
  const { role: contextRole, refreshRole } = useAuth();

  const getStoredUser = () => JSON.parse(localStorage.getItem('user') ?? '{}');
  const storedUser    = getStoredUser();

  const [firstName,  setFirstName]  = useState<string>(storedUser.first_name ?? '');
  const [lastName,   setLastName]   = useState<string>(storedUser.last_name  ?? '');
  const [email,      setEmail]      = useState<string>(storedUser.email      ?? '');
  const [avatarUrl,  setAvatarUrl]  = useState<string | null>(storedUser.profile_pic ?? storedUser.avatar_url ?? null);

  const currentRole = contextRole;

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw,       setShowNewPw]       = useState(false);
  const [showConfirmPw,   setShowConfirmPw]   = useState(false);

  const [saving,             setSaving]             = useState(false);
  const [uploadingAvatar,    setUploadingAvatar]    = useState(false);
  const [changingPw,         setChangingPw]         = useState(false);
  const [deletingAcc,        setDeletingAcc]        = useState(false);
  const [upgradingRole,      setUpgradingRole]      = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [deleteInput,        setDeleteInput]        = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const upgradeSectionRef = useRef<HTMLDivElement>(null);

  // ── Fetch fresh profile from Supabase on mount ─────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        navigate('/sign-in', { replace: true });
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('first_name, last_name, email, profile_pic')
        .eq('user_id', userId)
        .single();

      if (userData) {
        setFirstName(userData.first_name ?? '');
        setLastName(userData.last_name ?? '');
        setEmail(userData.email ?? '');
        setAvatarUrl(userData.profile_pic ?? null);

        const current = getStoredUser();
        localStorage.setItem('user', JSON.stringify({
          ...current,
          first_name:  userData.first_name,
          last_name:   userData.last_name,
          email:       userData.email,
          profile_pic: userData.profile_pic,
          avatar_url:  userData.profile_pic,
        }));
      }
      // Note: role is not fetched here — it lives in AuthContext
    };
    fetchProfile();
  }, []);

  // ── Scroll to section if requested ─────────────────────────────────────────
  useEffect(() => {
    if (scrollTo === 'upgrade' && upgradeSectionRef.current) {
      setTimeout(() => {
        upgradeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [scrollTo]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleError = (err: any, fallback: string) => {
    const msg = (err?.message ?? '').toLowerCase();
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('not authenticated')) {
      showToast('Session expired. Redirecting…', 'error');
      setTimeout(() => navigate('/sign-in', { replace: true }), 2000);
    } else {
      showToast(err?.message ?? fallback, 'error');
    }
  };

  // ── Save profile info ──────────────────────────────────────────────────────
  const handleSaveInfo = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      showToast('All fields are required.', 'error'); return;
    }
    setSaving(true);
    try {
      const result = await updateProfile({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim(),
      });
      const current = getStoredUser();
      localStorage.setItem('user', JSON.stringify({
        ...current,
        first_name: result.first_name,
        last_name:  result.last_name,
        email:      result.email,
      }));
      showToast('Account info saved!', 'success');
    } catch (err: any) {
      handleError(err, 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // ── Upload avatar ──────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.', 'error'); return; }

    setUploadingAvatar(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const ext  = file.name.split('.').pop();
      const path = `avatars/${userId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const { error: dbError } = await supabase
        .from('users')
        .update({ profile_pic: publicUrl })
        .eq('user_id', userId);
      if (dbError) throw dbError;

      setAvatarUrl(publicUrl);
      const current = getStoredUser();
      localStorage.setItem('user', JSON.stringify({
        ...current,
        profile_pic: publicUrl,
        avatar_url:  publicUrl,
      }));
      showToast('Profile photo updated!', 'success');
    } catch (err: any) {
      handleError(err, 'Failed to upload photo.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // ── Password validation (must match sign-up requirements) ──────────────────
  const validatePassword = (pw: string): string => {
    if (pw.length < 8)            return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(pw))        return 'Password must include at least one lowercase letter.';
    if (!/[A-Z]/.test(pw))        return 'Password must include at least one uppercase letter.';
    if (!/[0-9]/.test(pw))        return 'Password must include at least one number.';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw))
                                   return 'Password must include at least one special character.';
    return '';
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showToast('Please fill in both password fields.', 'error'); return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error'); return;
    }
    const pwError = validatePassword(newPassword);
    if (pwError) {
      showToast(pwError, 'error'); return;
    }
    setChangingPw(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully!', 'success');
    } catch (err: any) {
      handleError(err, 'Failed to change password.');
    } finally {
      setChangingPw(false);
    }
  };

  // ── Upgrade to business ────────────────────────────────────────────────────
  const handleUpgradeToBusiness = async () => {
    setUpgradingRole(true);
    try {
      // 1. Tell FastAPI backend to update the role in DB
      await upgradeToBusinessAccount();

      // 2. Re-fetch role from DB into AuthContext.
      //    This is the fix: instead of manually calling setRole('business'),
      //    we let refreshRole() read the DB and set the context. This way,
      //    if onAuthStateChange fires concurrently and calls fetchRole() too,
      //    both reads return 'business' and there's no race condition.
      await refreshRole();

      // 3. Verify the DB write actually committed (guards against silent failures)
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Session expired.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) throw new Error('Could not verify upgrade. Please try again.');
      if (profile?.role !== 'business') throw new Error('Role upgrade did not apply. Please try again.');

      setShowUpgradeConfirm(false);
      showToast('Account upgraded to business!', 'success');

      // 4. Short delay so the toast is visible, then navigate
      setTimeout(() => navigate('/dashboard/overview', { replace: true }), 1500);

    } catch (err: any) {
      handleError(err, 'Failed to upgrade account.');
    } finally {
      setUpgradingRole(false);
    }
  };

  // ── Delete account ─────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') { showToast('Type DELETE to confirm.', 'error'); return; }
    setDeletingAcc(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      localStorage.removeItem('user');
      navigate('/sign-in', { replace: true });
    } catch (err: any) {
      handleError(err, 'Failed to delete account.');
    } finally {
      setDeletingAcc(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-10 bg-black/70 backdrop-blur-sm cursor-default animate-in fade-in duration-200">
        <div className="flex flex-col w-full max-w-2xl h-[90vh] md:h-[85vh] md:max-h-[700px] bg-[#222222] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 animate-in zoom-in-95 duration-200 relative">

          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:top-5 md:right-5 w-9 h-9 flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700 rounded-full transition-colors cursor-pointer z-50"
            aria-label="Close settings"
          >
            <X size={16} className="text-zinc-300" />
          </button>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="p-8 md:p-10 w-full pt-12 md:pt-10">

              {/* Header */}
              <div className="mb-10">
                <h2 className="text-[#FFE2A0] font-['Playfair_Display'] text-3xl">Account Settings</h2>
                <p className="text-zinc-500 text-sm mt-1">Manage your account information and preferences.</p>
              </div>

              {/* Profile Picture */}
              <div className="mb-10">
                <SectionTitle>Profile Picture</SectionTitle>
                <div
                  onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                  className="flex items-center gap-5 p-4 bg-[#1C1C1C] border border-zinc-700/50 rounded-2xl hover:border-zinc-600 transition-all cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#FFE2A0] flex items-center justify-center ring-2 ring-zinc-700 group-hover:ring-[#FFE2A0]/40 transition-all">
                      {avatarUrl
                        ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                        : <User size={26} className="text-[#1A1A1A]" />
                      }
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#FFE2A0] rounded-full flex items-center justify-center shadow">
                      <Camera size={11} className="text-[#1A1A1A]" />
                    </div>
                  </div>
                  <div>
                    {uploadingAvatar ? (
                      <div className="flex items-center gap-2 text-[#FFE2A0]">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-sm font-medium">Uploading…</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-[#FFE2A0] transition-colors">
                          {avatarUrl ? 'Change photo' : 'Upload a photo'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">JPG, PNG · Max 5MB</p>
                      </>
                    )}
                  </div>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Account Information */}
              <div className="mb-10">
                <SectionTitle>Account Information</SectionTitle>
                <div className="grid grid-cols-2 gap-x-3">
                  <InputField label="First Name" value={firstName} onChange={setFirstName} placeholder="John" />
                  <InputField label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Doe"  />
                </div>
                <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                <button
                  onClick={handleSaveInfo} disabled={saving}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#FFE2A0] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#f5d880] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {/* Password & Security */}
              <div className="mb-10">
                <SectionTitle>Password &amp; Security</SectionTitle>
                <InputField
                  label="New Password" type={showNewPw ? 'text' : 'password'}
                  value={newPassword} onChange={setNewPassword} placeholder="Min. 8 characters"
                  rightElement={
                    <button type="button" onClick={() => setShowNewPw(v => !v)} className="hover:text-zinc-300 transition-colors cursor-pointer">
                      {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />
                <InputField
                  label="Confirm Password" type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat new password"
                  rightElement={
                    <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="hover:text-zinc-300 transition-colors cursor-pointer">
                      {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />
                {newPassword && confirmPassword && (
                  <p className={`text-xs mb-3 -mt-1 ${newPassword === confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
                <button
                  onClick={handleChangePassword} disabled={changingPw || !newPassword || !confirmPassword}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#2A2A2A] border border-zinc-700 text-[#FBFAF8] text-sm font-bold rounded-xl hover:bg-zinc-700 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {changingPw && <Loader2 size={14} className="animate-spin" />}
                  {changingPw ? 'Updating…' : 'Update Password'}
                </button>
              </div>

              {/* Upgrade to Business — only shown if role is 'user' */}
              {currentRole === 'user' && (
                <div className="mb-10">
                  <SectionTitle>Business Account</SectionTitle>
                  {!showUpgradeConfirm ? (
                    <div 
                      ref={upgradeSectionRef}
                      className="flex items-center justify-between p-4 bg-[#FFE2A0]/5 border border-[#FFE2A0]/20 rounded-2xl gap-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Briefcase size={14} className="text-[#FFE2A0]" /> Upgrade to Business
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          List your business and access the business dashboard.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowUpgradeConfirm(true)}
                        className="shrink-0 px-4 py-2 border border-[#FFE2A0]/40 text-[#FFE2A0] text-xs font-semibold rounded-xl hover:bg-[#FFE2A0] hover:text-[#1A1A1A] transition-all cursor-pointer"
                      >
                        Upgrade
                      </button>
                    </div>
                  ) : (
                    <div 
                      ref={upgradeSectionRef}
                      className="flex flex-col gap-3 p-5 bg-[#FFE2A0]/5 rounded-2xl border border-[#FFE2A0]/20"
                    >
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} className="text-[#FFE2A0] shrink-0" />
                        <p className="text-sm font-bold text-[#FFE2A0]">Confirm upgrade to business</p>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Your account will be upgraded to a business account. You'll gain access to the business dashboard and can list your business on Salangi.
                      </p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => setShowUpgradeConfirm(false)}
                          className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleUpgradeToBusiness}
                          disabled={upgradingRole}
                          className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-[#FFE2A0] text-[#1A1A1A] hover:bg-[#f5d880] disabled:opacity-40 transition-all cursor-pointer"
                        >
                          {upgradingRole
                            ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Upgrading…</span>
                            : 'Confirm Upgrade'
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manage Account */}
              <div className="mb-6">
                <SectionTitle>Manage Account</SectionTitle>
                {!showDeleteConfirm ? (
                  <div className="flex items-center justify-between p-4 bg-red-950/10 border border-red-900/30 rounded-2xl gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Trash2 size={14} className="text-red-400" /> Delete account
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">Permanent and cannot be undone.</p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="shrink-0 px-4 py-2 border border-red-800/60 text-red-400 text-xs font-semibold rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 p-5 bg-red-950/20 rounded-2xl border border-red-800/40">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} className="text-red-400 shrink-0" />
                      <p className="text-sm font-bold text-red-400">Confirm account deletion</p>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Type <span className="font-bold text-white bg-zinc-800 px-1 rounded">DELETE</span> to confirm. This cannot be undone.
                    </p>
                    <input
                      type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full bg-[#1C1C1C] border border-red-900/50 focus:border-red-500 text-sm text-white rounded-xl px-4 py-2.5 outline-none placeholder-zinc-600 transition-all"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deletingAcc || deleteInput !== 'DELETE'}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {deletingAcc
                          ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Deleting…</span>
                          : 'Confirm Delete'
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
};

export default SettingsPage;