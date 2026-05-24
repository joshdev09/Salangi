import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ROUTES } from '../../../routes/paths';
import { useAuth } from '@/context/authContext';
import { useGuestGuard } from '@/hooks/useGuestGuard';
import LoginPromptModal from '@/components/LoginPromptModal';
import BusinessCard from '../components/BusinessCard';
import SkeletonCard from '../components/SkeletonCard';              // ← new
import MapView from '../../../map/MapView';
import SearchBar from '../components/SearchBar';
import type { FilterOptions } from '../components/SearchBar';
import { getListings, getAverageRatings, CATEGORIES } from '../../Data/Listings';
import type { Listing, Category } from '../../Data/Listings';

import CategoryFilters from '../components/CategoryFilters';
import { Menu, X, Settings, LogOut } from 'lucide-react';
import { createPortal } from 'react-dom';
import SettingsPage from '../../settings/pages/SettingsPage';

function Homepage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, session } = useAuth();
  const { guardAction, loginPromptProps } = useGuestGuard();

  const [searchParams, setSearchParams] = useSearchParams();

  const [listings, setListings]               = useState<Listing[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [activeCategory, setActiveCategory]   = useState<Category>(CATEGORIES.ALL as Category);
  const [searchQuery,    setSearchQuery]       = useState<string>('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [savedIds, setSavedIds]               = useState<number[]>([]);
  const [averageRatings, setAverageRatings]   = useState<Record<number, number>>({});
  const [filters, setFilters]                 = useState<FilterOptions>({ ratingRange: null, sortBy: 'default' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen]   = useState(false);
  const [isRedirecting, setIsRedirecting]     = useState(false);

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    await supabase.auth.signOut();
    navigate(ROUTES.SIGN_IN);
  };

  const handleListBusinessClick = async () => {
    // If guest, show login prompt instead of navigating to the hero page
    if (!session) {
      guardAction('list-business', () => {});
      return;
    }
    setIsRedirecting(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const user = currentSession?.user ?? null;
      if (!user) {
        guardAction('list-business', () => {});
        setIsRedirecting(false);
        return;
      }

      const { data: userListings } = await supabase
        .from('listings')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (userListings && userListings.length > 0) {
        navigate(ROUTES.DASHBOARD_OVERVIEW);
      } else {
        if (role === 'business') {
          navigate(ROUTES.LIST_BUSINESS);
        } else {
          navigate(`${location.pathname}?settings=upgrade`);
        }
      }
    } catch {
      setIsRedirecting(false);
    } finally {
      setIsRedirecting(false);
    }
  };

  useEffect(() => {
    Promise.all([getListings(), getAverageRatings()])
      .then(([listingsData, ratingsData]) => {
        setListings(listingsData);
        setAverageRatings(ratingsData);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const listingId = searchParams.get('listingId');
    if (!listingId || !listings.length) return;

    const match = listings.find((l) => String(l.id) === listingId);
    if (!match) return;

    setSelectedListing(match);

    setTimeout(() => {
      document.getElementById(`listing-card-${match.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 400);

    setSearchParams((prev) => {
      prev.delete('listingId');
      return prev;
    }, { replace: true });
  }, [listings, searchParams, setSearchParams]);

  useEffect(() => {
    const autoSelectId = location.state?.autoSelectId;
    if (!autoSelectId || !listings.length) return;

    const match = listings.find((l) => l.id === autoSelectId);
    if (!match) return;

    setSelectedListing(match);

    setTimeout(() => {
      document.getElementById(`listing-card-${match.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 400);

    window.history.replaceState({}, '', window.location.pathname);
  }, [listings, location.state]);

  useEffect(() => {
    const fetchSaves = async () => {
      try {
        const user = session?.user;
        if (!user) return;
        const { data, error } = await supabase
          .from('saves')
          .select('listing_id')
          .eq('user_id', user.id);
        if (!error && data) {
          setSavedIds(data.map((row: any) => row.listing_id));
        }
      } catch (error) {
        console.warn("Error fetching saves:", error);
      }
    };
    fetchSaves();
  }, [session]);

  const toggleSave = async (id: number) => {
    guardAction('save', async () => {
      try {
        const user = session?.user;
        if (!user) return;
        const isSaved = savedIds.includes(id);
        if (isSaved) {
          await supabase.from('saves').delete().eq('user_id', user.id).eq('listing_id', id);
          setSavedIds(prev => prev.filter(savedId => savedId !== id));
        } else {
          await supabase.from('saves').insert({ user_id: user.id, listing_id: id });
          setSavedIds(prev => [...prev, id]);
        }
      } catch (error) {
        console.warn("Error toggling save:", error);
      }
    });
  };

  const filteredListings = useMemo<Listing[]>(() => {
    let result = listings.filter((item: Listing) => {
      const matchesCategory = activeCategory === CATEGORIES.ALL || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const rating = averageRatings[item.id] ?? 0;
      const matchesRating = filters.ratingRange === null ||
        (rating >= filters.ratingRange.min && rating <= filters.ratingRange.max);
      return matchesCategory && matchesSearch && matchesRating;
    });

    if (filters.sortBy === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (filters.sortBy === 'za') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [listings, activeCategory, searchQuery, filters, averageRatings]);

  const handleCardSelect = (listing: Listing): void => {
    setSelectedListing((prev: Listing | null) =>
      prev?.id === listing.id ? null : listing
    );
  };

  const handleCategoryChange = (cat: Category): void => {
    setActiveCategory(cat);
    setSelectedListing(null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    if (!selectedListing) return;
    const el = document.getElementById(`listing-card-${selectedListing.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedListing]);

  return (
    <div className="relative w-full h-full bg-[#1A1A1A] text-[#FBFAF8] overflow-hidden">

      {isRedirecting && createPortal(
        <div
          className="fixed inset-0 z-9999 flex flex-col items-center justify-center gap-6"
          style={{ backgroundColor: '#1A1A1A' }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(255,226,160,0.8) 0%, rgba(255,226,160,0.1) 60%, transparent 80%)',
            }}
          />
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-[#FFE2A0]/10" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#FFE2A0] animate-spin" />
          </div>
          <div className="text-center space-y-1 relative z-10">
            <p className="text-[#FFE2A0] font-semibold text-lg tracking-wide">Loading</p>
            <p className="text-[#FBFAF8]/40 text-sm">Taking you there...</p>
          </div>
        </div>,
        document.body
      )}

      <div
        className="absolute top-0 left-0 rounded-full blur-3xl opacity-60 pointer-events-none hidden md:block"
        style={{
          width: '760px',
          height: '680px',
          transform: 'translate(-400px, -440px)',
          background: 'radial-gradient(circle, rgba(255,226,160,0.8) 0%, rgba(255,226,160,0.2) 50%, transparent 70%)',
        }}
      />

      <div className="relative z-10 h-full flex flex-col md:flex-row px-4 py-4 md:px-6 md:py-6 gap-4 md:gap-6 overflow-y-auto md:overflow-hidden">

        {/* ── MOBILE TOP BAR & MENU ── */}
        <div className="md:hidden flex items-center justify-between w-full shrink-0 relative z-50 order-first">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-[#FFE2A0] hover:bg-[#FFE2A0]/10 rounded-lg transition-colors cursor-pointer"
          >
            <Menu size={28} />
          </button>
        </div>

        {isMobileMenuOpen && createPortal(
          <div className="fixed inset-0 z-9999 bg-[#1A1A1A] p-6 flex flex-col gap-8 md:hidden">
            <div className="flex justify-between items-center shrink-0">
              <h2 className="text-[#FFE2A0] font-['Playfair_Display'] text-2xl">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 text-[#FBFAF8]/70 hover:text-[#FFE2A0] rounded-lg transition-colors cursor-pointer"
              >
                <X size={28} />
              </button>
            </div>

            <div className="flex flex-col gap-6 flex-1">
              <div className="flex flex-col gap-2">
                <p className="text-[#FBFAF8]/50 text-xs font-semibold uppercase tracking-wider">Search Spots</p>
                <SearchBar
                  placeholder="Explore local spots"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e)}
                  className="py-3 w-full"
                  containerClassName="w-full shadow-lg"
                  onFilterChange={setFilters}
                  filters={filters}
                />
              </div>

              <div className="h-px w-full bg-[#373737]/50" />

              <button
                onClick={() => { setIsMobileMenuOpen(false); handleListBusinessClick(); }}
                className="flex items-center justify-center gap-2 px-4 py-3.5 bg-[#FFE2A0] text-[#1A1A1A] rounded-xl font-bold text-md w-full shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                {role === 'business' ? 'My Dashboard' : 'List Your Business'}
              </button>

              <button
                onClick={() => { setIsMobileMenuOpen(false); setIsSettingsOpen(true); }}
                className="flex items-center justify-center gap-3 px-4 py-3.5 bg-[#373737] text-[#FBFAF8] rounded-xl font-semibold text-md w-full shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <Settings size={20} className="text-[#FFE2A0]" />
                Settings
              </button>

              <button
                onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center justify-center gap-3 px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-semibold text-md w-full shadow-lg active:scale-95 transition-all cursor-pointer mt-auto"
              >
                <LogOut size={20} className="opacity-90" />
                Log out
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col shrink-0 w-full md:w-120 md:h-full overflow-visible md:overflow-hidden order-2 md:order-1">
          <div className="shrink-0 mb-4 md:mb-0">
            <h1 className="font-['Playfair_Display'] text-6xl md:text-3xl leading-tight mt-4 md:mt-0 text-[#FFE2A0]">
              Salangi
            </h1>
            <p className="mb-5 text-lg font-['Playfair_Display'] tracking-wide">
              Bring <span className="text-[#FFE2A0]">light</span> to my <span className="text-[#FFE2A0]"> home! </span>
            </p>
            <CategoryFilters
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              className="mb-5"
            />
          </div>

          <div className="flex-none md:flex-1 md:overflow-y-auto flex flex-col gap-4 md:gap-6 pb-24 md:pb-10 pr-1 md:pr-2 pl-1 pt-1 no-scrollbar">
            {isLoading ? (
              // ↓ Skeleton cards — same gap/layout as the real list
              Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            ) : filteredListings.length > 0 ? (
              filteredListings.map((listing: Listing) => (
                <BusinessCard
                  key={listing.id}
                  listing={listing}
                  onSelect={handleCardSelect}
                  isSelected={selectedListing?.id === listing.id}
                  isSaved={savedIds.includes(listing.id)}
                  onToggleSave={toggleSave}
                  rating={averageRatings[listing.id]}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-[#FBFAF8]/70 font-semibold">No places found</p>
                <p className="text-[#FBFAF8]/40 text-sm mt-1">
                  Try a different search term or category
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="hidden md:flex flex-col flex-none md:flex-1 w-full overflow-visible min-w-0 min-h-0 relative z-50 order-1 md:order-2 space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end gap-3 shrink-0">
            <SearchBar
              placeholder="Explore local spots"
              value={searchQuery}
              onChange={handleSearchChange}
              className="py-1 w-full"
              containerClassName="w-full md:w-80"
              onFilterChange={setFilters}
              filters={filters}
            />
            <button
              onClick={handleListBusinessClick}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#FFE2A0] text-[#1A1A1A] rounded-lg font-semibold text-sm whitespace-nowrap cursor-pointer hover:bg-[#f5d880] transition-colors w-full md:w-auto"
            >
              {role === 'business' ? 'My Dashboard' : 'List Your Business'}
            </button>
          </div>

          <div className="hidden md:block w-full h-75 md:h-auto md:flex-1 md:mt-2 md:min-h-0">
            <div className="w-full h-full rounded-2xl overflow-hidden">
              <MapView
                listings={filteredListings}
                selectedListing={selectedListing}
                onSelect={handleCardSelect}
              />
            </div>
          </div>
        </div>

      </div>

      {isSettingsOpen && createPortal(
        <SettingsPage onClose={() => setIsSettingsOpen(false)} />,
        document.body
      )}
      <LoginPromptModal {...loginPromptProps} />
    </div>
  );
}

export default Homepage;