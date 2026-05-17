import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Star, X, ZoomIn, Share2, Download } from 'lucide-react';
import type { Listing } from '../../Data/Listings';
import { ROUTES } from '../../../routes/paths';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';
import salangiLogo from '@assets/png-files/salangi-logo.png';

import OpenCloseBadge from '@/components/OpenCloseBadge';
import locBtnSelected from '@assets/icons/map-btn-active.svg';
import locBtn from '@assets/icons/map-btn-default.svg';
import verified from '@assets/icons/verified-btn.svg';
import saveInactive from '@assets/icons/save-btn-inactive.svg';
import saveActive from '@assets/icons/save-btn-active.svg';
import time from '@assets/icons/time-btn.svg';

interface BusinessCardProps {
  listing: Listing;
  onSelect: (listing: Listing) => void;
  isSelected: boolean;
  isSaved: boolean;
  onToggleSave: (id: number) => void;
  isBusinessSide?: boolean;
  onEdit?: (listing: Listing) => void;
  onDelete?: (id: number) => void;
  onViewAnalytics?: () => void;
  rating?: number;
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

function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50,
) {
  const ref = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      setDragOffset(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        const clamped = Math.sign(dx) * Math.min(Math.abs(dx) * 0.6, 80);
        setDragOffset(clamped);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      setDragOffset(0);
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx < 0) onSwipeLeft();
        else onSwipeRight();
      }
      touchStartX.current = null;
      touchStartY.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { ref, dragOffset };
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

  const { ref: lightboxSwipeRef, dragOffset: lightboxDrag } = useSwipe(onNext, onPrev);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/95 z-99999 flex items-center justify-center"
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

      <div
        ref={lightboxSwipeRef}
        className="max-w-[90vw] max-h-[90vh]"
        style={{
          transform: `translateX(${lightboxDrag}px)`,
          transition: lightboxDrag === 0 ? 'transform 0.25s ease' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[activeIndex]}
          alt={`Image ${activeIndex + 1}`}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
      </div>

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
    </div>,
    document.body
  );
}

function NoImagePlaceholder({ name }: { name: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#2a2a2a] gap-3 text-[#FBFAF8]/20 group-hover:bg-[#2d2d2d] transition-colors">
      <ImageIcon size={48} strokeWidth={1} />
      <div className="text-center px-6">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1">No Photos Yet</p>
        <p className="text-[10px] text-[#FBFAF8]/10 line-clamp-1">{name}</p>
      </div>
    </div>
  );
}

function BusinessCard({ 
  listing, 
  onSelect, 
  isSelected, 
  isSaved, 
  onToggleSave, 
  isBusinessSide,
  onEdit,
  onViewAnalytics,
  rating = 0,
}: BusinessCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGallery = async () => {
      const { data } = await supabase
        .from('gallery_images')
        .select('url')
        .eq('listing_id', listing.id)
        .order('added_date', { ascending: false });

      const galleryUrls = data?.map((row: any) => row.url) ?? [];
      const merged = [...(listing.images ?? []), ...galleryUrls];
      setGalleryImages(dedupeImages(merged));
    };
    fetchGallery();
  }, [listing.id, listing.images]);

  const hasImages = galleryImages.length > 0;

  const goNext = useCallback(() => {
    setImgError(false);
    setCurrentIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  }, [galleryImages.length]);

  const goPrev = useCallback(() => {
    setImgError(false);
    setCurrentIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  }, [galleryImages.length]);

  const nextImage = (e: React.MouseEvent) => { e.stopPropagation(); goNext(); };
  const prevImage = (e: React.MouseEvent) => { e.stopPropagation(); goPrev(); };

  const { ref: swipeRef, dragOffset } = useSwipe(goNext, goPrev);

  const lightboxNext = useCallback(() => {
    setLightboxIndex((prev) => prev === null ? null : (prev === galleryImages.length - 1 ? 0 : prev + 1));
  }, [galleryImages.length]);

  const lightboxPrev = useCallback(() => {
    setLightboxIndex((prev) => prev === null ? null : (prev === 0 ? galleryImages.length - 1 : prev - 1));
  }, [galleryImages.length]);

  const handleCardClick = () => {
    onSelect(listing);
    if (!isBusinessSide) {
      supabase.from('listing_interactions').insert({
        listing_id: listing.id,
        type: 'view',
      });
    }
  };

  const handleShowInMaps = async (e: React.MouseEvent) => {
    e.stopPropagation();
    supabase.from('listing_interactions').insert({
      listing_id: listing.id,
      type: 'directions',
    });
    navigate(ROUTES.LOCATION, { state: { listing } });
  };

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    const shareUrl = listing.slug
      ? `${window.location.origin}/listing/${listing.slug}`
      : `${window.location.origin}/home-page?listingId=${listing.id}`;

    supabase.from('listing_interactions').insert({ listing_id: listing.id, type: 'share' });

    // Generate QR code with logo overlay
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, shareUrl, {
      width: size,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#FBFAF8' },
    });
    ctx.drawImage(qrCanvas, 0, 0);

    const logoSize = size * 0.18;
    const cx = size / 2;
    const cy = size / 2;
    const padding = 8;

    ctx.beginPath();
    ctx.arc(cx, cy, logoSize / 2 + padding, 0, Math.PI * 2);
    ctx.fillStyle = '#FBFAF8';
    ctx.fill();

    const logo = new Image();
    logo.src = salangiLogo;
    await new Promise<void>((res) => { logo.onload = () => res(); });
    ctx.drawImage(logo, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);

    setQrDataUrl(canvas.toDataURL('image/png'));
    setShowQR(true);
  }, [listing.id, listing.slug]);

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          images={galleryImages}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxPrev}
          onNext={lightboxNext}
        />
      )}

      <div
        id={`listing-card-${listing.id}`}
        onClick={handleCardClick}
        className={`w-full max-w-120 min-h-550px bg-[#333333] rounded-xl cursor-pointer overflow-hidden flex flex-col shrink-0 transition-all duration-200 border border-zinc-800/50 ${
          isSelected
            ? 'ring-2 ring-[#FFE2A0] shadow-xl shadow-[#FFE2A0]/5'
            : 'hover:bg-[#3d3d3d] hover:shadow-2xl hover:shadow-black/50'
        }`}
      >
        <div className="relative group">
          {!isBusinessSide && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(listing.id);
              }}
              className="absolute top-4 left-4 flex items-center justify-center w-10 h-10 bg-[#222222]/80 backdrop-blur-sm rounded-full z-20 cursor-pointer hover:scale-110 active:scale-95 shadow-lg border border-white/10"
            >
              <img src={isSaved ? saveActive : saveInactive} width="20" alt="heart" />
            </button>
          )}

          <div className="relative w-full h-80 overflow-hidden bg-zinc-800">
            {hasImages && !imgError ? (
              <div
                ref={swipeRef}
                className="relative w-full h-full cursor-zoom-in select-none"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(currentIndex); }}
              >
                <img
                  key={galleryImages[currentIndex]}
                  src={galleryImages[currentIndex]}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                  style={{
                    transform: `translateX(${dragOffset}px) ${dragOffset !== 0 ? 'scale(0.98)' : ''}`,
                    transition: dragOffset === 0 ? 'transform 0.3s ease' : 'none',
                  }}
                  alt={`${listing.name} - ${currentIndex + 1}`}
                  onError={() => setImgError(true)}
                  draggable={false}
                />
                {dragOffset !== 0 && (
                  <div
                    className="absolute inset-0 flex items-center pointer-events-none"
                    style={{ justifyContent: dragOffset < 0 ? 'flex-end' : 'flex-start' }}
                  >
                    <div className={`mx-3 w-8 h-8 flex items-center justify-center bg-black/50 rounded-full transition-opacity ${Math.abs(dragOffset) > 20 ? 'opacity-100' : 'opacity-0'}`}>
                      {dragOffset < 0
                        ? <ChevronRight size={16} className="text-white" />
                        : <ChevronLeft size={16} className="text-white" />
                      }
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end pb-10 pr-3 pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2">
                    <ZoomIn size={15} className="text-white" />
                  </div>
                </div>
              </div>
            ) : (
              <NoImagePlaceholder name={listing.name} />
            )}

            {hasImages && !imgError && galleryImages.length > 1 && (
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

            {hasImages && !imgError && galleryImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {galleryImages.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      currentIndex === idx ? 'bg-[#FFE2A0] w-4' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}

            {hasImages && !imgError && galleryImages.length > 1 && (
              <div className="absolute top-3 right-3 bg-[#222222]/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full z-20">
                {currentIndex + 1} / {galleryImages.length}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 flex flex-col flex-1">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-[#FBFAF8] font-['Playfair_Display'] font-bold text-2xl tracking-tight leading-tight">
                {listing.name}
              </h3>
              {listing.verified && (
                <img src={verified} width="16" height="16" alt="verified" className="mt-1" />
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="px-2 py-1 rounded border border-[#FFE2A0]/20 bg-[#FFE2A0]/5 flex items-center justify-center">
                <span className="text-[#FFE2A0] text-[9px] font-bold uppercase tracking-widest leading-none">
                  {listing.category}
                </span>
              </div>
              {rating > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star size={12} fill="#FFE2A0" className="text-[#FFE2A0]" />
                  <span className="text-[#FFE2A0] text-xs font-bold leading-none">
                    {rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-[#FBFAF8]/70 leading-relaxed line-clamp-2 mb-6">
            {listing.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
            <div className="flex items-center gap-2">
              <img src={locBtnSelected} width="14" alt="location" className="opacity-70" />
              <span className="text-[#FBFAF8]/50 text-xs font-medium">{listing.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <img src={time} width="14" alt="hours" className="opacity-70" />
              <span className="text-[#FBFAF8]/50 text-xs font-medium">{formatHours(listing.hours)}</span>
              <OpenCloseBadge hours={listing.hours} />
            </div>
          </div>

          <div className="flex gap-3 mt-auto">
            {isBusinessSide ? (
              <div className="flex gap-3 w-full">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(listing);
                  }}
                  className="flex-1 py-3.5 bg-[#454545] text-white text-xs font-bold rounded-xl hover:bg-[#525252] transition-all active:scale-95 cursor-pointer shadow-lg border border-white/5"
                >
                  Edit Listing
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewAnalytics?.();
                  }}
                  className="flex-1 py-3.5 bg-[#FFE2A0] text-[#222222] text-xs font-bold rounded-xl hover:bg-[#ffe8b5] transition-all active:scale-95 cursor-pointer shadow-lg"
                >
                  View Analytics
                </button>
              </div>
            ) : (
              <div className="w-full flex gap-3">
                <button
                  onClick={handleShowInMaps}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-[#FFE2A0] text-[#222222] text-xs font-bold rounded-xl hover:bg-[#ffe8b5] transition-all active:scale-95 cursor-pointer shadow-lg"
                >
                  <img src={locBtn} width="14" alt="show" />
                  <span>Show in maps</span>
                </button>

                <div className="relative">
                  <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 bg-[#454545] text-[#FBFAF8] text-xs font-bold rounded-xl hover:bg-[#525252] transition-all active:scale-95 cursor-pointer shadow-lg border border-white/5"
                  >
                    <Share2 size={14} />
                    <span>Share</span>
                  </button>

                  {copyFeedback && createPortal(
                    <div
                      style={{
                        position: 'fixed',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 99999,
                      }}
                      className="bg-[#222222] text-[#FFE2A0] text-[10px] font-bold px-3 py-1.5 rounded-lg border border-[#FFE2A0]/20 whitespace-nowrap shadow-xl pointer-events-none"
                    >
                      Link copied!
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showQR && qrDataUrl && createPortal(
        <div
          onClick={() => setShowQR(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e1e1e', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '320px', width: '90%' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <p style={{ color: '#FBFAF8', fontWeight: 700, fontSize: '15px', margin: 0 }}>{listing.name}</p>
                <p style={{ color: '#888', fontSize: '11px', margin: 0, marginTop: '2px' }}>Scan to open listing</p>
              </div>
              <button
                onClick={() => setShowQR(false)}
                style={{ background: '#333', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FBFAF8' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* QR Image */}
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '3px solid #FFE2A0', lineHeight: 0 }}>
              <img src={qrDataUrl} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <a
                href={qrDataUrl}
                download={`salangi-${listing.slug || listing.id}.png`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFE2A0', color: '#1a1a1a', fontWeight: 700, fontSize: '12px', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
              >
                <Download size={13} />
                Save QR Code
              </a>
              <button
                onClick={() => {
                  const shareUrl = listing.slug
                    ? `${window.location.origin}/listing/${listing.slug}`
                    : `${window.location.origin}/home-page?listingId=${listing.id}`;
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    setCopyFeedback(true);
                    setTimeout(() => setCopyFeedback(false), 2000);
                  });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2e2e2e', color: copyFeedback ? '#FFE2A0' : '#FBFAF8', fontWeight: 700, fontSize: '12px', padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', width: '100%', justifyContent: 'center', cursor: 'pointer', transition: 'color 0.2s' }}
              >
                {copyFeedback ? '✓ Link copied!' : '🔗 Copy Link'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default BusinessCard;