import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import search from '@assets/icons/search-back-btn.svg';
import sampleImage from '@assets/png-files/imagesample.png';
import bg from '@assets/images/bg.png';
import DetailedBusinessCard from '../components/DetailedBusinessCard';
import SearchBar from '../components/SearchBar';
import type { FilterOptions } from '../components/SearchBar';
import MapView from '../../../map/MapView';
import type { NavInfo } from '../../../map/MapView';
import type { Listing } from '../../Data/Listings';
import { getListings, getAverageRatings } from '../../Data/Listings';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/authContext';
import { useGuestGuard } from '@/hooks/useGuestGuard';
import LoginPromptModal from '@/components/LoginPromptModal';

interface Review {
  id: number;
  user: string;
  initials: string;
  date: string;
  rating: number;
  comment: string;
  profilePic?: string;
}

function Locationpage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { guardAction, loginPromptProps } = useGuestGuard();
  const incomingListing: Listing | undefined = state?.listing;

  const [listings, setListings] = useState<Listing[]>([]);
  const [averageRatings, setAverageRatings] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({ ratingRange: null, sortBy: 'default' });

  const [selectedListing, setSelectedListing] = useState<Listing | null>(
    incomingListing ?? null
  );
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(!!incomingListing);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [navInfo, setNavInfo] = useState<NavInfo | null>(null);

  // ── Drag state ───────────────────────────────────────────────────────────
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);

  // ── Load all listings & ratings ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([getListings(), getAverageRatings()])
      .then(([listingsData, ratingsData]) => {
        setListings(listingsData);
        setAverageRatings(ratingsData);
      })
      .catch(console.error);
  }, []);

  // ── Load saved IDs ───────────────────────────────────────────────────────
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

  // ── Load gallery images when selected listing changes ────────────────────
  useEffect(() => {
    if (!selectedListing) return;

    const fetchGalleryImages = async () => {
      const { data } = await supabase
        .from('gallery_images')
        .select('url')
        .eq('listing_id', selectedListing.id)
        .order('added_date', { ascending: false });

      const listingMainImage = selectedListing.images?.[0];

      if (data && data.length > 0) {
        const galleryUrls = data.map((row: any) => row.url);
        setGalleryImages([
          ...(listingMainImage ? [listingMainImage] : []),
          ...galleryUrls,
        ]);
      } else {
        setGalleryImages(selectedListing.images ?? []);
      }
    };

    fetchGalleryImages();
  }, [selectedListing?.id]);

  // ── Load reviews when selected listing changes ───────────────────────────
  useEffect(() => {
    if (!selectedListing) return;
    fetchReviews(selectedListing.id);
  }, [selectedListing?.id]);

  const fetchReviews = async (listingId: number) => {
    setReviewsLoading(true);
    try {
      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .select('id, listing_id, user_id, rating, comment, created_at')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      if (reviewError) { console.error('reviews error:', reviewError); return; }
      if (!reviewData || reviewData.length === 0) { setReviews([]); return; }

      const userIds = [...new Set(reviewData.map((r: any) => r.user_id))];
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, profile_pic')
        .in('user_id', userIds);

      if (userError) console.error('users error:', userError);

      const userMap: Record<string, any> = {};
      (userData ?? []).forEach((u: any) => { userMap[u.user_id] = u; });

      const mapped: Review[] = reviewData.map((r: any) => {
        const u = userMap[r.user_id];
        const firstName = u?.first_name ?? 'Anonymous';
        const lastName = u?.last_name ?? '';
        const fullName = `${firstName} ${lastName}`.trim();
        const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
        return {
          id: r.id,
          user: fullName,
          initials,
          date: new Date(r.created_at).toLocaleDateString('en-US', {
            month: 'long', day: '2-digit', year: 'numeric'
          }),
          rating: r.rating,
          comment: r.comment,
          profilePic: u?.profile_pic ?? null,
        };
      });

      setReviews(mapped);
    } catch (err) {
      console.error('fetchReviews unexpected error:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const toggleSave = async (id: number) => {
    guardAction('save', async () => {
      try {
        const user = session?.user;
        if (!user) return;
        const isSaved = savedIds.includes(id);
        if (isSaved) {
          await supabase.from('saves').delete().eq('user_id', user.id).eq('listing_id', id);
          setSavedIds(prev => prev.filter(sid => sid !== id));
        } else {
          await supabase.from('saves').insert({ user_id: user.id, listing_id: id });
          setSavedIds(prev => [...prev, id]);
        }
      } catch (error) {
        console.warn("Error toggling save:", error);
      }
    });
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const handleMarkerSelect = (listing: Listing) => {
    setSelectedListing(listing);
    setSidebarOpen(true);
    setDragOffset(0);
    setSearchQuery('');
    setSearchOpen(false);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    setDragOffset(0);
    setTimeout(() => setSelectedListing(null), 350);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // ── Drag handlers with visual friction and constraints ─────────────────────
  const handleDragStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    setDragOffset(0);
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    
    if (delta > 0) {
      const naturalOffset = Math.min(delta * 0.6, 200);
      setDragOffset(naturalOffset);
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    if (dragOffset > 140) {
      setSidebarOpen(false);
      setTimeout(() => setDragOffset(0), 350);
    } else {
      setDragOffset(0);
    }
  };

  const isSearching = searchQuery.trim().length > 0;

  const searchResults = isSearching
    ? listings
        .filter((item: Listing) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.location.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .filter((item: Listing) => {
          const rating = averageRatings[item.id] ?? 0;
          return filters.ratingRange === null ||
            (rating >= filters.ratingRange.min && rating <= filters.ratingRange.max);
        })
        .sort((a, b) => {
          if (filters.sortBy === 'az') return a.name.localeCompare(b.name);
          if (filters.sortBy === 'za') return b.name.localeCompare(a.name);
          return 0;
        })
    : [];

  return (
    <div
      className="relative w-full overflow-hidden bg-[#1A1A1A]"
      style={{ height: '100dvh' }}
    >

      {/* ── Full-screen Map ─────────────────────────────────────────────── */}
      <div className={`absolute inset-0 z-0 ${sidebarOpen ? 'md:left-500px' : 'md:left-0'}`}>
        <MapView
          listings={listings}
          selectedListing={selectedListing}
          onSelect={handleMarkerSelect}
          onNavInfo={setNavInfo}
          onMapClick={handleCloseSidebar}
        />
      </div>

      {/* ── Floating top bar ────────────────────────────────────────────── */}
      <div className={`absolute top-0 left-0 right-0 z-40 flex items-center gap-2 px-4 py-4 pointer-events-none ${sidebarOpen ? 'md:left-500px' : 'md:left-0'}`}>
        <button
          onClick={() => navigate(-1)}
          className={`pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-[#2D2D2D]/90 hover:bg-[#3D3D3D] backdrop-blur-sm transition-colors cursor-pointer shrink-0 shadow-lg ${sidebarOpen ? 'hidden' : 'flex'}`}
        >
          <img src={search} width="18" alt="back" />
        </button>

        <div
          className={`pointer-events-auto flex-1 transition-all duration-300 ${
            searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none w-0 overflow-hidden'
          }`}
        >
          <SearchBar
            containerClassName="flex-1"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search local spots..."
            onFilterChange={setFilters}
            filters={filters}
          />
        </div>

        {/* Unified nav HUD pill (md:hidden removed so it functions perfectly on web views) */}
        {!searchOpen && navInfo && (
          <div className="pointer-events-auto flex items-stretch bg-[#0F172A]/92 backdrop-blur-md rounded-full shadow-lg overflow-hidden border border-white/10 shrink-0 h-10">
            <div className="flex flex-col items-center justify-center px-4 py-1 border-r border-white/10">
              <span className="text-[9px] font-semibold tracking-widest text-slate-500 uppercase leading-none mb-0.5">ETA</span>
              <span className="text-xs font-bold text-[#FFE2A0] leading-none">{navInfo.eta}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-1">
              <span className="text-[9px] font-semibold tracking-widest text-slate-500 uppercase leading-none mb-0.5">Dist</span>
              <span className="text-xs font-bold text-[#F1F5F9] leading-none">{navInfo.distanceRemaining}</span>
            </div>
          </div>
        )}

        {!searchOpen && (
          <button
            onClick={() => setSearchOpen(true)}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-[#2D2D2D]/90 hover:bg-[#3D3D3D] backdrop-blur-sm transition-colors shadow-lg text-[#FBFAF8]/70 text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span className="hidden sm:inline">Search local spots…</span>
          </button>
        )}

        {searchOpen && (
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-[#2D2D2D]/90 hover:bg-[#3D3D3D] backdrop-blur-sm transition-colors cursor-pointer shrink-0 shadow-lg text-[#FBFAF8]"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Search results dropdown ─────────────────────────────────────── */}
      {isSearching && (
        <div className={`absolute top-20 left-4 right-4 z-20 ${sidebarOpen ? 'md:left-516px' : 'md:left-4'} rounded-xl bg-[#1A1A1A]/95 backdrop-blur-sm border border-zinc-700/50 shadow-2xl max-h-72 overflow-y-auto`}>
          {searchResults.length > 0 ? (
            <div className="flex flex-col divide-y divide-zinc-800/50">
              {searchResults.map((item: Listing) => (
                <div
                  key={item.id}
                  onClick={() => handleMarkerSelect(item)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#2D2D2D] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#FBFAF8] truncate">{item.name}</p>
                    <p className="text-xs text-[#FBFAF8]/50 truncate">{item.location}</p>
                  </div>
                  {averageRatings[item.id] != null && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[#FFE2A0] text-xs">★</span>
                      <span className="text-[#FBFAF8]/50 text-xs">
                        {averageRatings[item.id].toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-[#FBFAF8]/50 text-sm">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* ── "Tap a pin" hint ────────────────────────────────────────────── */}
      {!sidebarOpen && !isSearching && (
        <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none`}>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1A1A1A]/80 backdrop-blur-sm border border-zinc-700/40 shadow-xl">
            <span className="text-base">📍</span>
            <span className="text-xs text-[#FBFAF8]/70 font-medium whitespace-nowrap">
              Tap a pin to explore businesses
            </span>
          </div>
        </div>
      )}

      {/* ── Re-open card button — shown when card is dismissed but route is active ── */}
      {!sidebarOpen && selectedListing && navInfo && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1A1A1A]/90 backdrop-blur-sm border border-zinc-700/40 shadow-xl text-[#FBFAF8]/80 text-xs font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 15l-6-6-6 6"/>
            </svg>
            View {selectedListing.name}
          </button>
        </div>
      )}

      {/* ── Detail Sidebar ──────────────────────────────────────────────── */}
      <div
        onClick={() => { if (!sidebarOpen && selectedListing) setSidebarOpen(true); }}
        className={`
          absolute z-[40] 
          left-0 right-0 h-[60vh] rounded-t-2xl
          bottom-[72px] 
          md:top-0 md:bottom-0 md:left-0 md:right-auto md:h-full md:rounded-none md:bottom-0
          bg-[#1A1A1A] border-t border-zinc-800 md:border-t-0 md:border-r
          overflow-hidden flex flex-col
          ${!sidebarOpen ? 'cursor-pointer' : ''} 
        `}
        style={{
          willChange: 'transform',
          minWidth: 'min(500px, 100%)',
          width: 'min(500px, 100%)',
          maxWidth: '500px',
          transform: sidebarOpen
            ? `translateY(${dragOffset}px)`
            : 'translateY(calc(100% - 44px))', 
          transition: isDragging.current
            ? 'none'
            : 'transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1)',
        }}
      >
        {/* Drag handle (mobile only) */}
        <div
          className="md:hidden flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-zinc-500" />
        </div>

        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-zinc-800/60 md:border-b-0 md:pt-4">
          <button
            onClick={(e) => { e.stopPropagation(); handleCloseSidebar(); }}
            className="hidden md:flex items-center gap-2 text-[#FBFAF8]/50 hover:text-[#FBFAF8] transition-colors text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
            </svg>
            Back to map
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleCloseSidebar(); }}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-[#2D2D2D] hover:bg-[#3D3D3D] transition-colors text-[#FBFAF8]/70 text-sm"
          >
            ✕
          </button>
          <div className="md:hidden" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 md:px-6">
          {selectedListing && (
            <DetailedBusinessCard
              listingId={selectedListing.id}
              title={selectedListing.name}
              location={selectedListing.location}
              hours={selectedListing.hours}
              description={selectedListing.description}
              images={galleryImages}
              isVerified={selectedListing.verified}
              phone={selectedListing.phone}
              email={selectedListing.email}
              facebook={selectedListing.facebook}
              website={selectedListing.website}
              rating={averageRating}
              reviewsCount={reviews.length}
              reviews={reviews}
              reviewsLoading={reviewsLoading}
              initialSaved={savedIds.includes(selectedListing.id)}
              onToggleSave={toggleSave}
              onReviewAdded={() => fetchReviews(selectedListing.id)}
            />
          )}
        </div>
      </div>

      <LoginPromptModal {...loginPromptProps} />
    </div>
  );
}

export default Locationpage;