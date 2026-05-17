import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, X, ZoomIn, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase'; 
import { useAuth } from '@/context/authContext';
import { createPortal } from 'react-dom';
import locBtnSelected from '@assets/icons/map-btn-active.svg';
import locBtn from '@assets/icons/direction-btn.svg';
import verifiedIcon from '@assets/icons/verified-btn.svg';
import heartInactive from '@assets/icons/save-btn-inactive.svg';
import heartActive from '@assets/icons/save-btn-active.svg';
import timeIcon from '@assets/icons/time-btn.svg';
import callIcon from '@assets/icons/phone-icon.svg';
import emailIcon from '@assets/icons/emain-icon.svg';
import facebookIcon from '@assets/icons/fb-icon.svg';
import websiteIcon from '@assets/icons/web-icon.svg';
import starIcon from '@assets/icons/star-icon.svg';
import commentIcon from '@assets/icons/review-btn-default.svg';

import OpenCloseBadge from '@/components/OpenCloseBadge';
import ReviewItem from './ReviewItem';
import ReviewForm from './ReviewForm';
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

interface DetailedBusinessCardProps {
  listingId: number;
  title: string;
  location: string;
  hours: string;
  description: string;
  images: string[];
  phone?: string;
  email?: string;
  facebook?: string;
  website?: string;
  rating: number;
  reviewsCount: number;
  reviews: Review[];
  reviewsLoading?: boolean;
  isVerified?: boolean;
  initialSaved?: boolean;
  lat?: number;
  lng?: number;
  onToggleSave?: (id: number) => void;
  onReviewAdded?: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatHours(hours: string): string {
  if (!hours) return '';
  const timeMatch = hours.match(/,?\s*(\d{1,2}:\d{2}\s*(?:AM|PM)\s*[–—-]\s*\d{1,2}:\d{2}\s*(?:AM|PM))\s*$/i);
  const timePart = timeMatch ? timeMatch[1].trim() : '';
  const daysPart = timeMatch ? hours.slice(0, timeMatch.index) : hours;
  const activeDays = DAYS.filter(d => daysPart.includes(d));
  if (activeDays.length === 0) return hours;
  const ranges: string[] = [];
  let rangeStart = activeDays[0];
  let rangePrev = activeDays[0];
  for (let i = 1; i <= activeDays.length; i++) {
    const curr = activeDays[i];
    const prevIdx = DAYS.indexOf(rangePrev);
    const currIdx = curr ? DAYS.indexOf(curr) : -1;
    if (curr && currIdx === prevIdx + 1) {
      rangePrev = curr;
    } else {
      ranges.push(rangeStart === rangePrev ? rangeStart : `${rangeStart} – ${rangePrev}`);
      rangeStart = curr!;
      rangePrev = curr!;
    }
  }
  const dayString = ranges.join(', ');
  return timePart ? `${dayString}, ${timePart}` : dayString;
}

function dedupeImages(images: string[]): string[] {
  return [...new Set((images ?? []).filter(Boolean))];
}

interface LightboxProps {
  images: string[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function Lightbox({ images, activeIndex, onClose, onPrev, onNext }: LightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-colors z-10 cursor-pointer"
      >
        <X size={18} className="text-white" />
      </button>

      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
          {activeIndex + 1} / {images.length}
        </div>
      )}

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-colors cursor-pointer"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
      )}

      <img
        src={images[activeIndex]}
        alt={`Image ${activeIndex + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-colors cursor-pointer"
        >
          <ChevronRight size={20} className="text-white" />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeIndex === idx ? 'bg-[#FFE2A0] w-4' : 'bg-white/40 w-1.5'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DetailedBusinessCard({
  listingId,
  title,
  location,
  hours,
  description,
  images,
  phone,
  email,
  facebook,
  website,
  rating,
  reviewsCount,
  reviews,
  reviewsLoading = false,
  isVerified = false,
  initialSaved = false,
  lat,
  lng,
  onToggleSave,
  onReviewAdded,
}: DetailedBusinessCardProps) {
  const { session } = useAuth();
  const { guardAction, loginPromptProps } = useGuestGuard();
  const [isSaved, setIsSaved] = useState(initialSaved);
  const allImages = dedupeImages(images);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ── Custom Tab ─────────────────────────────────────────────────────────────
  type TabName = 'overview' | 'custom' | 'reviews' | 'photos';
  interface TabItem { id: number; category: string; name: string; price: number; sort_order: number; }
  const [activeTab, setActiveTab] = useState<TabName>('overview');
  const [customTabLabel, setCustomTabLabel] = useState<string | null>(null);
  const [tabItems, setTabItems] = useState<TabItem[]>([]);

  // ── Visitor Photos ─────────────────────────────────────────────────────────
  interface VisitorPhoto { id: string; url: string; storage_path: string; user_id: string; uploaded_at: string; }
  const [visitorPhotos, setVisitorPhotos] = useState<VisitorPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const hasImages = allImages.length > 0;

  useEffect(() => {
    supabase.from('listing_interactions').insert({
      listing_id: listingId,
      type: 'view',
    });
  }, [listingId]);

  // ── Fetch custom tab data ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchTab = async () => {
      const { data: tabRow } = await supabase
        .from('listing_tabs')
        .select('*')
        .eq('listing_id', listingId)
        .eq('is_enabled', true)
        .maybeSingle();

      if (!tabRow) return;

      const label = tabRow.tab_label.charAt(0).toUpperCase() + tabRow.tab_label.slice(1);
      setCustomTabLabel(label);

      const { data: items } = await supabase
        .from('listing_tab_items')
        .select('*')
        .eq('listing_id', listingId)
        .order('sort_order');

      setTabItems(items ?? []);
    };

    fetchTab();
  }, [listingId]);

  // ── Fetch visitor photos ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'photos') return;
    const fetchPhotos = async () => {
      setPhotosLoading(true);
      const { data } = await supabase
        .from('visitor_photos')
        .select('*')
        .eq('listing_id', listingId)
        .order('uploaded_at', { ascending: false });
      setVisitorPhotos(data ?? []);
      setPhotosLoading(false);
    };
    fetchPhotos();
  }, [listingId, activeTab]);

  // ── Sightengine image moderation ──────────────────────────────────────────
  const isImageSafe = async (file: File): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('models', 'nudity,offensive,gore');
      formData.append('api_user', import.meta.env.VITE_SIGHTENGINE_USER);
      formData.append('api_secret', import.meta.env.VITE_SIGHTENGINE_SECRET);
      const res = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status !== 'success') return true; // fail open if API errors
      const nudity = data.nudity?.raw ?? 0;
      const offensive = data.offensive?.prob ?? 0;
      const gore = data.gore?.prob ?? 0;
      return nudity < 0.6 && offensive < 0.6 && gore < 0.6;
    } catch {
      return true; // fail open on network error
    }
  };

  // ── Sightengine text moderation ───────────────────────────────────────────
  const isTextSafe = async (text: string): Promise<boolean> => {
    try {
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3000));
      const check = fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/moderate-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      )
        .then(res => res.json())
        .then(data => data?.safe === true)
        .catch(() => true);
      return await Promise.race([check, timeout]);
    } catch {
      return true;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user) return;
    setPhotoUploading(true);

    const safe = await isImageSafe(file);
    if (!safe) {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
      alert('This image was flagged as inappropriate and could not be uploaded.');
      return;
    }

    const storagePath = `visitor/${listingId}/${session.user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('gallery-images')
      .upload(storagePath, file);
    if (uploadError) { setPhotoUploading(false); return; }
    const { data: urlData } = supabase.storage.from('gallery-images').getPublicUrl(storagePath);
    const { data: inserted } = await supabase
      .from('visitor_photos')
      .insert({ listing_id: listingId, user_id: session.user.id, url: urlData.publicUrl, storage_path: storagePath })
      .select().single();
    if (inserted) setVisitorPhotos(prev => [inserted, ...prev]);
    setPhotoUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handlePhotoDelete = async (photo: VisitorPhoto) => {
    await supabase.storage.from('gallery-images').remove([photo.storage_path]);
    await supabase.from('visitor_photos').delete().eq('id', photo.id);
    setVisitorPhotos(prev => prev.filter(p => p.id !== photo.id));
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const lightboxNext = useCallback(() => {
    setLightboxIndex((prev) => prev === null ? null : (prev === allImages.length - 1 ? 0 : prev + 1));
  }, [allImages.length]);

  const lightboxPrev = useCallback(() => {
    setLightboxIndex((prev) => prev === null ? null : (prev === 0 ? allImages.length - 1 : prev - 1));
  }, [allImages.length]);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    guardAction('save', async () => {
      if (onToggleSave) {
        onToggleSave(listingId);
        setIsSaved(prev => !prev);
      } else {
        try {
          const user = session?.user;
          if (!user) return;
          if (isSaved) {
            await supabase.from('saves').delete().eq('user_id', user.id).eq('listing_id', listingId);
          } else {
            await supabase.from('saves').insert({ user_id: user.id, listing_id: listingId });
          }
          setIsSaved(prev => !prev);
        } catch (error) {
          console.warn("Error toggling save:", error);
        }
      }
    });
  };

  const handleGetDirections = async () => {
    await supabase.from('listing_interactions').insert({
      listing_id: listingId,
      type: 'directions',
    });
    const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const handleAddReview = async (rating: number, comment: string) => {
    setSubmitting(true);
    setReviewError(null);
    try {
      const user = session?.user;
      if (!user) {
        setReviewError('You must be logged in to leave a review.');
        setSubmitting(false);
        return;
      }
      const safe = await isTextSafe(comment);
      if (!safe) {
        setReviewError('Your review contains inappropriate language. Please revise and try again.');
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.from('reviews').insert({
        listing_id: listingId,
        user_id: user.id,
        rating,
        comment,
      });
      if (error) throw error;
      setIsAddingReview(false);
      onReviewAdded?.();
    } catch (err: any) {
      setReviewError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <>
      {lightboxIndex !== null && createPortal(
        <Lightbox
          images={allImages}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxPrev}
          onNext={lightboxNext}
        />,
        document.body
      )}

      {/* ✅ FIX 1: added max-w-120 and mx-auto to match deployed */}
      <div className="bg-[#333333] rounded-xl overflow-hidden shrink-0 mb-10 shadow-2xl border border-zinc-800/50" style={{ width: '100%' }}>
        <div className="relative flex flex-col">

          {/* Heart Icon */}
          <div className="absolute top-4 left-4 z-30">
            <button
              onClick={handleToggleSave}
              className="flex items-center justify-center w-10 h-10 bg-[#222222]/80 backdrop-blur-sm rounded-full z-20 cursor-pointer hover:scale-110 active:scale-95 shadow-lg border border-white/10"
            >
              <img src={isSaved ? heartActive : heartInactive} width="20" alt="heart" />
            </button>
          </div>

          {/* ✅ FIX 2: changed h-80 to h-72 to match deployed */}
          <div className="relative w-full h-72 overflow-hidden bg-zinc-800 group">
            {hasImages ? (
              <>
                <div
                  className="relative w-full h-full cursor-zoom-in"
                  onClick={() => setLightboxIndex(currentIndex)}
                >
                  <img
                    src={allImages[currentIndex]}
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                    alt={`${title} - ${currentIndex + 1}`}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end pb-10 pr-3">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2 pointer-events-none">
                      <ZoomIn size={15} className="text-white" />
                    </div>
                  </div>
                </div>

                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#222222]/50 hover:bg-[#222222]/80 backdrop-blur-sm rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                    >
                      <ChevronLeft size={16} className="text-white" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#222222]/50 hover:bg-[#222222]/80 backdrop-blur-sm rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                    >
                      <ChevronRight size={16} className="text-white" />
                    </button>
                  </>
                )}

                {allImages.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                    {allImages.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          currentIndex === idx ? 'bg-[#FFE2A0] w-4' : 'bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                )}

                <div className="absolute top-3 right-3 bg-[#222222]/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full z-20">
                  {currentIndex + 1} / {allImages.length}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#2a2a2a] text-[#FBFAF8]/20">
                <ImageIcon size={56} strokeWidth={1} />
                <div className="text-center px-6">
                  <p className="text-[11px] uppercase tracking-[0.2em] font-bold mb-1">No Photos Found</p>
                  <p className="text-[10px] text-[#FBFAF8]/10 line-clamp-1">{title}</p>
                </div>
              </div>
            )}
          </div>


          <div className="p-6 min-h-[420px] min-w-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-[#FBFAF8] font-['Playfair_Display'] font-bold text-2xl tracking-tight leading-tight">
                  {title}
                </h3>
                {isVerified && (
                  <img src={verifiedIcon} width="16" height="16" alt="verified" className="mt-1" />
                )}
              </div>
            </div>

            {/* ── Tab Bar ──────────────────────────────────────────────────── */}
            <div className="flex gap-1 mb-5 border-b border-zinc-700/50">
              {(['overview', ...(customTabLabel ? ['custom'] : []), 'reviews', 'photos'] as const).map((tab) => {
                const label = tab === 'custom' ? customTabLabel! : tab.charAt(0).toUpperCase() + tab.slice(1);
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as TabName)}
                    className={`px-4 py-2 text-xs font-semibold tracking-wide transition-all border-b-2 -mb-px cursor-pointer ${
                      isActive
                        ? 'border-[#FFE2A0] text-[#FFE2A0]'
                        : 'border-transparent text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Overview Panel ───────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <>
                <p className="text-sm text-[#FBFAF8]/70 leading-relaxed mb-2 pb-6">
                  {description}
                </p>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 pb-6 border-b border-zinc-600/50">
                  <div className="flex items-center gap-2">
                    <img src={locBtnSelected} width="14" alt="location" className="opacity-70" />
                    <span className="text-[#FBFAF8]/50 text-xs font-medium">{location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={timeIcon} width="14" alt="hours" className="opacity-70" />
                    <span className="text-[#FBFAF8]/50 text-xs font-medium">{formatHours(hours)}</span>
                    <OpenCloseBadge hours={hours} />
                  </div>
                </div>

                <div className="flex flex-col gap-1 pb-6">
                  {phone && (
                    <div
                      onClick={() => handleCopy(phone, 'phone')}
                      className="relative flex items-center gap-4 text-sm text-[#FBFAF8]/80 hover:text-[#FBFAF8] px-3 py-2.5 rounded-xl border border-transparent hover:border-[#FFE2A0] hover:bg-[#FFE2A0]/5 transition-all duration-300 cursor-pointer group"
                    >
                      <img src={callIcon} width="16" className="opacity-70 group-hover:opacity-100" alt="call" />
                      <span>{phone}</span>
                      {copyFeedback === 'phone' && <span className="absolute right-4 text-[10px] text-[#FFE2A0] font-bold">Copied!</span>}
                    </div>
                  )}
                  {email && (
                    <div
                      onClick={() => handleCopy(email, 'email')}
                      className="relative flex items-center gap-4 text-sm text-[#FBFAF8]/80 hover:text-[#FBFAF8] px-3 py-2.5 rounded-xl border border-transparent hover:border-[#FFE2A0] hover:bg-[#FFE2A0]/5 transition-all duration-300 cursor-pointer group"
                    >
                      <img src={emailIcon} width="16" className="opacity-70 group-hover:opacity-100" alt="email" />
                      <span>{email}</span>
                      {copyFeedback === 'email' && <span className="absolute right-4 text-[10px] text-[#FFE2A0] font-bold">Copied!</span>}
                    </div>
                  )}
                  {facebook && (
                    <div
                      onClick={() => window.open(facebook.startsWith('http') ? facebook : `https://${facebook}`, '_blank')}
                      className="relative flex items-center gap-4 text-sm text-[#FBFAF8]/80 hover:text-[#FBFAF8] px-3 py-2.5 rounded-xl border border-transparent hover:border-[#FFE2A0] hover:bg-[#FFE2A0]/5 transition-all duration-300 cursor-pointer group min-w-0"
                    >
                      <img src={facebookIcon} width="16" className="opacity-70 group-hover:opacity-100 shrink-0" alt="fb" />
                      <span className="truncate">{facebook}</span>
                    </div>
                  )}
                  {website && (
                    <div
                      onClick={() => window.open(website.startsWith('http') ? website : `https://${website}`, '_blank')}
                      className="relative flex items-center gap-4 text-sm text-[#FBFAF8]/80 hover:text-[#FBFAF8] px-3 py-2.5 rounded-xl border border-transparent hover:border-[#FFE2A0] hover:bg-[#FFE2A0]/5 transition-all duration-300 cursor-pointer group"
                    >
                      <img src={websiteIcon} width="16" className="opacity-70 group-hover:opacity-100" alt="web" />
                      <span>{website}</span>
                    </div>
                  )}
                  <button
                    onClick={handleGetDirections}
                    className="mt-2 flex items-center gap-3 text-sm text-[#FBFAF8]/80 hover:text-[#FBFAF8] px-3 py-2.5 rounded-xl border border-transparent hover:border-[#FFE2A0] hover:bg-[#FFE2A0]/5 transition-all duration-300 cursor-pointer group w-full text-left"
                  >
                    <img src={locBtn} width="16" className="opacity-70 group-hover:opacity-100" alt="directions" />
                    <span>Get Directions</span>
                  </button>
                </div>
              </>
            )}

            {/* ── Custom Tab Panel ─────────────────────────────────────────── */}
            {activeTab === 'custom' && customTabLabel && (
              <div className="pb-6">
                {tabItems.length === 0 ? (
                  <p className="text-sm text-[#FBFAF8]/40 text-center py-8">No items added yet.</p>
                ) : (() => {
                  const grouped = tabItems.reduce<Record<string, typeof tabItems>>((acc, item) => {
                    const cat = item.category || 'General';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {});
                  return Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="mb-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFE2A0]/60 mb-2">{category}</p>
                      <div className="flex flex-col">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2.5"
                            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
                          >
                            <span className="text-sm text-[rgba(255,255,255,0.7)]">{item.name}</span>
                            <span className="text-sm font-semibold text-[#FFE2A0] ml-4 shrink-0">
                              ₱{Number(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* ── Reviews Panel ────────────────────────────────────────────── */}
            {activeTab === 'reviews' && (
              <>
                <div className="py-4">
                  <p className="text-xs text-zinc-400 mb-1">Customer Reviews ({reviewsCount})</p>
                  <div className="flex flex-col">
                    <span className="text-5xl font-serif text-[#FBFAF8]">
                      {reviewsCount > 0 ? rating.toFixed(1) : '—'}
                    </span>
                    <div className="flex gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <img key={i} src={starIcon} width="9" alt="star"
                          className={i < Math.floor(rating) ? 'opacity-100' : 'opacity-30'} />
                      ))}
                    </div>
                  </div>
                </div>

                {reviewsLoading ? (
                  <p className="text-sm text-zinc-500 animate-pulse">Loading reviews...</p>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-zinc-500">No reviews yet. Be the first!</p>
                ) : (
                  <div className="space-y-12 mt-4">
                    {reviews.map((review) => (
                      <ReviewItem key={review.id} {...review} />
                    ))}
                  </div>
                )}

                <div className="mt-8">
                  {reviewError && <p className="text-red-400 text-sm mb-3">{reviewError}</p>}
                  {isAddingReview ? (
                    <ReviewForm
                      onSubmit={handleAddReview}
                      onCancel={() => { setIsAddingReview(false); setReviewError(null); }}
                      submitting={submitting}
                    />
                  ) : (
                    <div className="flex justify-end">
                      <button
                        onClick={() => guardAction('review', () => setIsAddingReview(true))}
                        className="flex items-center gap-2 bg-[#FFE2A0] text-[#373737] px-4 py-2 rounded-lg text-xs hover:brightness-110 transition-all active:scale-95 shadow-lg cursor-pointer"
                      >
                        <span><img src={commentIcon} alt="comment" /></span> Leave a review
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {/* ── Photos Panel ─────────────────────────────────────────────── */}
            {activeTab === 'photos' && (
              <div className="pb-6">
                {/* Upload button */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-zinc-400">
                    {visitorPhotos.length} visitor photo{visitorPhotos.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => guardAction('photo', () => photoInputRef.current?.click())}
                    disabled={photoUploading}
                    className="flex items-center gap-1.5 bg-[#FFE2A0] text-[#1a1a1a] px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={13} />
                    {photoUploading ? 'Uploading...' : 'Add Photo'}
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </div>

                {photosLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square bg-[#2a2a2a] animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : visitorPhotos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                      <ImageIcon size={24} className="text-zinc-600" />
                    </div>
                    <p className="text-sm text-zinc-500">No visitor photos yet</p>
                    <p className="text-xs text-zinc-600">Be the first to share a photo!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {visitorPhotos.map((photo, idx) => (
                      <div
                        key={photo.id}
                        className="group relative aspect-square rounded-lg overflow-hidden bg-[#2a2a2a] cursor-zoom-in"
                        onClick={() => setPhotoLightboxIndex(idx)}
                      >
                        <img src={photo.url} alt="visitor photo" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                        {/* Delete button — always visible on touch, hover-only on desktop */}
                        {session?.user?.id === photo.user_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePhotoDelete(photo); }}
                            className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/80 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Trash2 size={11} className="text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Lightbox for visitor photos */}
                {photoLightboxIndex !== null && createPortal(
                  <Lightbox
                    images={visitorPhotos.map(p => p.url)}
                    activeIndex={photoLightboxIndex}
                    onClose={() => setPhotoLightboxIndex(null)}
                    onPrev={() => setPhotoLightboxIndex(i => i === null ? null : (i === 0 ? visitorPhotos.length - 1 : i - 1))}
                    onNext={() => setPhotoLightboxIndex(i => i === null ? null : (i === visitorPhotos.length - 1 ? 0 : i + 1))}
                  />,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <LoginPromptModal {...loginPromptProps} />
    </>
  );
}

export default DetailedBusinessCard;