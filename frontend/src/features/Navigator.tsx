import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Settings, LogOut } from 'lucide-react';
import { createPortal } from 'react-dom';
import SettingsPage from './settings/pages/SettingsPage';
import { ROUTES } from '../routes/paths';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/authContext';
import { useGuestGuard } from '@/hooks/useGuestGuard';
import LoginPromptModal from '@/components/LoginPromptModal';

// icons
import homeBtn from '@assets/icons/home-btn-default.svg';
import locBtn from '@assets/icons/map-btn-default.svg';
import saveBtn from '@assets/icons/save-btn-default.svg';
import eventsBtn from '@assets/icons/events-btn-default.svg';
import salangiLogo from '@assets/png-files/salangi-logo.png';

// colored icons
import homeBtnSelected from '@assets/icons/home-btn-active.svg';
import locBtnSelected from '@assets/icons/map-btn-active.svg';
import saveBtnSelected from '@assets/icons/save-btn-active.svg';
import eventsBtnSelected from '@assets/icons/events-btn-active.svg';

interface NavItemProps {
  to: string;
  defaultIcon: string;
  activeIcon: string;
  alt: string;
  isEnd?: boolean;
  onGuestClick?: () => void;
}

const NavItem = ({ to, defaultIcon, activeIcon, alt, isEnd = false, onGuestClick }: NavItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  if (onGuestClick) {
    return (
      <div
        onClick={onGuestClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`flex items-center justify-center transition-all duration-200 border w-12 h-12 md:w-14 md:h-14 rounded-xl cursor-pointer ${
          isHovered ? 'bg-[#222222] border-[#FFE2A0]' : 'bg-transparent border-transparent'
        }`}
      >
        <img src={isHovered ? activeIcon : defaultIcon} alt={alt} className="w-6 h-6 object-contain" />
      </div>
    );
  }

  return (
    <NavLink to={to} end={isEnd}>
      {({ isActive }) => {
        const showActive = isActive || isHovered;
        return (
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`flex items-center justify-center transition-all duration-200 border w-12 h-12 md:w-14 md:h-14 rounded-xl ${
              showActive ? 'bg-[#222222]' : 'bg-transparent border-transparent'
            } ${isHovered ? 'border-[#FFE2A0]' : 'border-transparent'}`}
          >
            <img
              src={showActive ? activeIcon : defaultIcon}
              alt={alt}
              className="w-6 h-6 object-contain"
            />
          </div>
        );
      }}
    </NavLink>
  );
};



export function Navigator() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { guardAction, loginPromptProps } = useGuestGuard();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scrollTo, setScrollTo] = useState<'upgrade' | null>(null);

  // Check for search params to open settings
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const settingsParam = params.get('settings');
    if (settingsParam === 'upgrade') {
      setIsSettingsOpen(true);
      setScrollTo('upgrade');
    }
  }, [location.search]);

  // Function to handle closing settings and clearing query params
  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setScrollTo(null);
    if (location.search.includes('settings=')) {
      const params = new URLSearchParams(location.search);
      params.delete('settings');
      const newSearch = params.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true });
    }
    refreshUser();
  };
  const menuRef = useRef<HTMLDivElement>(null);
  const [displayName, setDisplayName] = useState({
    firstName: '',
    lastName: '',
    email: '',
    avatarUrl: '' as string | null,
  });

  const refreshUser = useCallback(async () => {
    try {
      const user = session?.user;
      if (!user) return;

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut();
        navigate('/sign-in');
        return;
      }

      const { data: profile, error } = await supabase
        .from('users')
        .select('first_name, last_name, email, profile_pic')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) console.warn('Error refreshing user profile:', error);

      // Google OAuth puts name in full_name, not first_name/last_name
      const meta = user.user_metadata ?? {};
      const fullNameParts = (meta.full_name ?? '').trim().split(' ');
      const metaFirst = meta.first_name || fullNameParts[0] || '';
      const metaLast  = meta.last_name  || fullNameParts.slice(1).join(' ') || '';
      const metaAvatar = (meta.avatar_url || meta.picture || null);
      // Skip Google-hosted avatars — they rate-limit aggressively (429)
      const safeAvatar = metaAvatar?.includes('googleusercontent.com') ? null : metaAvatar;

      const firstName = profile?.first_name || metaFirst;
      const lastName  = profile?.last_name  || metaLast;

      // If no users row exists yet (Google OAuth new user), create one
      if (!profile && (firstName || user.email)) {
        await supabase.from('users').upsert({
          user_id:     user.id,
          first_name:  firstName,
          last_name:   lastName,
          email:       user.email,
          profile_pic: safeAvatar,
        }, { onConflict: 'user_id' });
      }

      setDisplayName({
        firstName,
        lastName,
        email:     profile?.email || user.email || '',
        avatarUrl: profile?.profile_pic || safeAvatar,
      });
    } catch (error) {
      console.warn("Error refreshing user profile:", error);
    }
  }, [navigate, session]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const initials = displayName.firstName && displayName.lastName
    ? `${displayName.firstName[0]}${displayName.lastName[0]}`.toUpperCase()
    : '?';

  const fullName = displayName.firstName && displayName.lastName
    ? `${displayName.firstName} ${displayName.lastName}`
    : 'Guest';

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    await supabase.auth.signOut();
    navigate(ROUTES.SIGN_IN);
  };

  const AvatarButton = ({ onClick, className }: { onClick?: () => void; className?: string }) => (
    <button
      onClick={onClick}
      className={`h-11 w-11 md:h-14 md:w-14 bg-[#2E2E2E] rounded-lg cursor-pointer flex items-center justify-center overflow-hidden transition-all hover:bg-[#222222] ${className}`}
    >
      {displayName.avatarUrl ? (
        <img
          src={displayName.avatarUrl}
          alt="avatar"
          className="w-full h-full object-cover"
          onError={() => setDisplayName(prev => ({ ...prev, avatarUrl: null }))}
        />
      ) : (
        <p className="font-['Playfair-Display'] text-[#FFE2A0] text-xl">{initials}</p>
      )}
    </button>
  );

  return (
    <div className="flex flex-col-reverse md:flex-row h-screen overflow-hidden">

      {/* Sidebar / Bottom Nav */}
      <div className="bg-[#373737] fixed bottom-0 left-0 right-0 w-full h-18 md:static md:w-20 md:h-full p-2 md:p-3 flex flex-row md:flex-col justify-between items-center shrink-0 z-50">
        <div className="hidden md:block">
          <button
            onClick={() => navigate('/home-page')}
            className="cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity duration-200"
          >
            <img src={salangiLogo} alt="Salangi" className="w-20 h-20 object-contain" />
          </button>
        </div>

        <div className="flex flex-row md:flex-col items-center justify-center gap-6 md:gap-8 w-full md:w-auto px-4 md:px-0">
          <NavItem
            to={ROUTES.HOME}
            defaultIcon={homeBtn}
            activeIcon={homeBtnSelected}
            alt="Home"
            isEnd
          />
          <NavItem
            to={ROUTES.LOCATION}
            defaultIcon={locBtn}
            activeIcon={locBtnSelected}
            alt="Location"
          />
          <NavItem
            to={ROUTES.SAVE}
            defaultIcon={saveBtn}
            activeIcon={saveBtnSelected}
            alt="Save"
            onGuestClick={!session ? () => guardAction('save', () => {}) : undefined}
          />
          <NavItem
            to={ROUTES.EVENTS_PAGE}
            defaultIcon={eventsBtn}
            activeIcon={eventsBtnSelected}
            alt="Events"
          />
        </div>

        <div className="relative pr-4 md:pr-0 hidden md:block">
          {!session ? (
            <button
              onClick={() => navigate(ROUTES.SIGN_IN)}
              className="h-11 w-11 md:h-14 md:w-14 bg-[#FFE2A0]/10 border border-[#FFE2A0]/30 hover:bg-[#FFE2A0]/20 rounded-lg cursor-pointer flex items-center justify-center transition-all"
              title="Sign In"
            >
              <span className="text-[#FFE2A0] text-xs font-bold">Login</span>
            </button>
          ) : (
          <>
          {isMenuOpen && (
            <div
              ref={menuRef}
              className="absolute bottom-16 md:bottom-18 right-4 md:-right-4 md:translate-x-full w-64 bg-[#2D2D2D] rounded-2xl shadow-2xl border border-zinc-700/50 py-3 px-3 z-50 flex flex-col gap-1 transition-all"
            >
              <div className="flex items-center gap-3 p-2 py-3">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-[#222222] flex items-center justify-center shrink-0">
                  {displayName.avatarUrl ? (
                    <img
                      src={displayName.avatarUrl}
                      alt="avatar"
                      className="w-full h-full object-cover"
                      onError={() => setDisplayName(prev => ({ ...prev, avatarUrl: null }))}
                    />
                  ) : (
                    <span className="text-[#FFE2A0] text-xs font-bold">{initials}</span>
                  )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <p className="text-[#FBFAF8] text-sm font-semibold truncate">{fullName}</p>
                  <p className="text-gray-400 text-xs truncate">{displayName.email}</p>
                </div>
              </div>

              <div className="h-px bg-zinc-700/50 my-1 mx-2" />

              <button
                onClick={() => { setIsMenuOpen(false); setIsSettingsOpen(true); }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#3D3D3D] transition-colors cursor-pointer text-[#FBFAF8]/90 hover:text-white"
              >
                <Settings size={18} className="opacity-70" />
                <span className="text-sm font-medium">Settings</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer text-[#FBFAF8]/90 hover:text-red-500"
              >
                <LogOut size={18} className="opacity-70" />
                <span className="text-sm font-medium">Log out</span>
              </button>
            </div>
          )}

          <AvatarButton onClick={() => setIsMenuOpen(!isMenuOpen)} />
          </>
          )}
        </div>
      </div>

      <main className="flex-1 bg-[#1E1E1E] overflow-hidden pb-18 md:pb-0">
        <Outlet />
      </main>

      {isSettingsOpen && createPortal(
        <SettingsPage
          onClose={handleCloseSettings}
          scrollTo={scrollTo}
        />,
        document.body
      )}

      <LoginPromptModal {...loginPromptProps} />
    </div>
  );
}

export default Navigator;