import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle, XCircle, LogOut, MapPin, Clock,
  ChevronLeft, ChevronRight, X, ZoomIn, CalendarDays,
  Phone, Globe, Facebook, Mail, FileText, Eye, Lock, User,
} from 'lucide-react';
import { ROUTES } from '../../../routes/paths';
import { useAdminGuard } from '../../../hooks/useAdminGuard';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// ── Types ─────────────────────────────────────────────────────────────────────

interface Listing {
  id: number;
  name: string;
  category: string;
  location: string;
  description: string;
  hours: string;
  verified: boolean;
  images: string[];
  business_permit: string | null;
  government_id: string | null;
  selfie_verification: string | null;
  phone?: string;
  email?: string;
  facebook?: string;
  website?: string;
  lat?: number | null;
  lng?: number | null;
}

interface PendingEvent {
  id: number;
  title: string;
  description: string;
  location: string;
  time: string;
  date_range: string;
  month: string;
  day: string;
  image_url: string | null;
  images?: string[];
  verified: boolean;
  created_at: string;
  lat?: number | null;
  lng?: number | null;
}

// ── Mini Map ──────────────────────────────────────────────────────────────────

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView([lat, lng], 16);
    mapInstanceRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    L.marker([lat, lng]).addTo(map);
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [lat, lng]);

  return <div ref={mapRef} style={{ height: '180px', width: '100%', borderRadius: '12px', overflow: 'hidden' }} />;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-6" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white hover:text-[#FFE2A0] transition-colors">
        <X size={28} />
      </button>
      <img src={src} alt="preview" className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ── Image Carousel ────────────────────────────────────────────────────────────

function ImageCarousel({ images, onImageClick }: { images: string[]; onImageClick: (src: string) => void }) {
  const [current, setCurrent] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-48 h-32 rounded-xl bg-[#2D2D2D] flex items-center justify-center text-[#FBFAF8]/20 text-xs shrink-0 border border-zinc-800">
        No photos
      </div>
    );
  }

  return (
    <div className="relative w-full sm:w-48 h-48 sm:h-32 rounded-xl overflow-hidden shrink-0 group border border-zinc-800">
      <img
        src={images[current]}
        alt="listing"
        className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
        onClick={() => onImageClick(images[current])}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center pointer-events-none">
        <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrent(p => (p - 1 + images.length) % images.length); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCurrent(p => (p + 1) % images.length); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors">
            <ChevronRight size={14} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'bg-[#FFE2A0] w-4' : 'bg-white/40 w-1.5'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Doc Thumbnail (with signed URL resolver) ──────────────────────────────────
// Handles both:
//   - Old listings: src is already a full public URL (http/https) → use directly
//   - New listings: src is a storage path (e.g. "permits/abc.jpg") → generate signed URL

function DocThumb({ src, label, onImageClick }: { src: string; label: string; onImageClick: (src: string) => void }) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!src) { setLoading(false); return; }

    const resolve = async () => {
      setLoading(true);

      // Already a full URL (old listings stored public URLs) → use as-is
      if (src.startsWith('http')) {
        setResolvedSrc(src);
        setLoading(false);
        return;
      }

      // Storage path → generate a 1-hour signed URL from private-documents bucket
      const { data, error } = await supabase.storage
        .from('private-documents')
        .createSignedUrl(src, 60 * 60);

      if (!error && data?.signedUrl) {
        setResolvedSrc(data.signedUrl);
      } else {
        console.error('Signed URL error for', src, error);
        setResolvedSrc(null);
      }
      setLoading(false);
    };

    resolve();
  }, [src]);

  const isPdf = src?.toLowerCase().includes('.pdf');

  const handleClick = () => {
    if (!resolvedSrc) return;
    if (isPdf) window.open(resolvedSrc, '_blank');
    else onImageClick(resolvedSrc);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-24 h-20 rounded-xl overflow-hidden border border-zinc-700 cursor-zoom-in relative group hover:border-[#FFE2A0]/40 transition-colors"
        onClick={handleClick}
      >
        {loading ? (
          // Spinner while resolving signed URL
          <div className="w-full h-full bg-[#2D2D2D] animate-pulse flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-[#FFE2A0]/30 border-t-[#FFE2A0] animate-spin" />
          </div>
        ) : !resolvedSrc ? (
          // Failed to resolve
          <div className="w-full h-full bg-[#2D2D2D] flex flex-col items-center justify-center gap-1">
            <span className="text-lg">⚠️</span>
            <span className="text-[10px] text-[#FBFAF8]/30">Unavailable</span>
          </div>
        ) : isPdf ? (
          <div className="w-full h-full bg-[#2D2D2D] flex flex-col items-center justify-center gap-1">
            <span className="text-2xl">📄</span>
            <span className="text-xs text-[#FBFAF8]/40">PDF</span>
          </div>
        ) : (
          <>
            <img src={resolvedSrc} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
              <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-[#FBFAF8]/40">{label}</p>
    </div>
  );
}

// ── Listing Detail Modal ──────────────────────────────────────────────────────

function ListingDetailModal({
  listing,
  onClose,
  onApprove,
  onReject,
  actionLoading,
}: {
  listing: Listing;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  actionLoading: number | null;
}) {
  const [imgIndex, setImgIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const hasMap = typeof listing.lat === 'number' && typeof listing.lng === 'number';

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handler); };
  }, [onClose]);

  return createPortal(
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div
        className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl bg-[#2a2a2a] rounded-2xl border border-zinc-700/50 shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image hero */}
          <div className="relative h-56 shrink-0">
            {listing.images?.length > 0 ? (
              <>
                <img
                  src={listing.images[imgIndex]}
                  alt={listing.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightbox(listing.images[imgIndex])}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2a2a2a] via-transparent to-transparent pointer-events-none" />
                {listing.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIndex(i => (i - 1 + listing.images.length) % listing.images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-all"
                    >
                      <ChevronLeft size={16} className="text-white" />
                    </button>
                    <button
                      onClick={() => setImgIndex(i => (i + 1) % listing.images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-all"
                    >
                      <ChevronRight size={16} className="text-white" />
                    </button>
                    <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5">
                      {listing.images.map((_, i) => (
                        <button key={i} onClick={() => setImgIndex(i)}
                          className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-[#FFE2A0] w-4' : 'bg-white/40 w-1.5'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-[#333] flex items-center justify-center text-[#FBFAF8]/20">No Photos</div>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-all z-10"
            >
              <X size={16} className="text-white" />
            </button>

            {/* Category badge */}
            <div className="absolute bottom-4 left-4">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#FFE2A0] border border-[#FFE2A0]/30 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                {listing.category}
              </span>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {/* Title */}
            <div>
              <h2 className="text-[#FBFAF8] font-['Playfair_Display'] font-bold text-2xl leading-tight">{listing.name}</h2>
            </div>

            <div className="border-t border-white/10" />

            {/* Public Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {listing.location && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={14} className="text-[#FFE2A0]" />
                  </div>
                  <div>
                    <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Location</p>
                    <p className="text-[#FBFAF8] text-sm">{listing.location}</p>
                  </div>
                </div>
              )}
              {listing.hours && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={14} className="text-[#FFE2A0]" />
                  </div>
                  <div>
                    <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Hours</p>
                    <p className="text-[#FBFAF8] text-sm">{listing.hours}</p>
                  </div>
                </div>
              )}
              {listing.facebook && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0 mt-0.5">
                    <Facebook size={14} className="text-[#FFE2A0]" />
                  </div>
                  <div>
                    <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Facebook</p>
                    <a href={listing.facebook} target="_blank" rel="noopener noreferrer" className="text-[#FFE2A0] text-sm hover:underline truncate block max-w-xs">{listing.facebook}</a>
                  </div>
                </div>
              )}
              {listing.website && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0 mt-0.5">
                    <Globe size={14} className="text-[#FFE2A0]" />
                  </div>
                  <div>
                    <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Website</p>
                    <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-[#FFE2A0] text-sm hover:underline">{listing.website}</a>
                  </div>
                </div>
              )}
            </div>

            {/* 🔒 Private Info Section */}
            {(listing.phone || listing.email) && (
              <>
                <div className="border-t border-white/10" />
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={12} className="text-amber-400" />
                    <p className="text-amber-400 text-[10px] uppercase tracking-wider font-bold">Private Info — Admin Only</p>
                  </div>
                  {listing.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                        <Phone size={12} className="text-[#FFE2A0]" />
                      </div>
                      <div>
                        <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Phone</p>
                        <p className="text-[#FBFAF8] text-sm">{listing.phone}</p>
                      </div>
                    </div>
                  )}
                  {listing.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                        <Mail size={12} className="text-[#FFE2A0]" />
                      </div>
                      <div>
                        <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Email</p>
                        <p className="text-[#FBFAF8] text-sm">{listing.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {listing.description && (
              <>
                <div className="border-t border-white/10" />
                <div>
                  <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Description</p>
                  <p className="text-[#FBFAF8]/70 text-sm leading-relaxed">{listing.description}</p>
                </div>
              </>
            )}

            {/* Map */}
            {hasMap && (
              <>
                <div className="border-t border-white/10" />
                <div>
                  <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold mb-3">Location Map</p>
                  <MiniMap lat={listing.lat as number} lng={listing.lng as number} />
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${listing.lat}&mlon=${listing.lng}&zoom=17`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-2 text-[#FFE2A0] text-xs hover:underline"
                  >
                    <MapPin size={11} /> Open in Maps
                  </a>
                </div>
              </>
            )}

            {/* Verification Docs */}
            {(listing.business_permit || listing.government_id || listing.selfie_verification) && (
              <>
                <div className="border-t border-white/10" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock size={12} className="text-amber-400" />
                    <p className="text-amber-400 text-[10px] uppercase tracking-wider font-bold">Verification Documents — Admin Only</p>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {listing.business_permit && <DocThumb src={listing.business_permit} label="Business Permit" onImageClick={setLightbox} />}
                    {listing.government_id && <DocThumb src={listing.government_id} label="Government ID" onImageClick={setLightbox} />}
                    {listing.selfie_verification && <DocThumb src={listing.selfie_verification} label="Selfie" onImageClick={setLightbox} />}
                  </div>
                </div>
              </>
            )}

            {/* Action buttons */}
            <div className="border-t border-white/10 pt-2 flex gap-3">
              <button
                onClick={() => onApprove(listing.id)}
                disabled={actionLoading === listing.id}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600/80 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 border border-green-500/30 shadow-lg"
              >
                <CheckCircle size={16} /> Approve Listing
              </button>
              <button
                onClick={() => onReject(listing.id)}
                disabled={actionLoading === listing.id}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 border border-red-600/30 shadow-lg"
              >
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Event Detail Modal ────────────────────────────────────────────────────────

function EventDetailModal({
  event,
  onClose,
  onApprove,
  onReject,
  actionLoading,
}: {
  event: PendingEvent;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  actionLoading: number | null;
}) {
  const allImages: string[] = (event as any).images?.length
    ? (event as any).images
    : (event.image_url ? [event.image_url] : []);
  const [imgIndex, setImgIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const hasMap = typeof event.lat === 'number' && typeof event.lng === 'number';

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handler); };
  }, [onClose]);

  return createPortal(
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div
        className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl bg-[#2a2a2a] rounded-2xl border border-zinc-700/50 shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image hero */}
          <div className="relative h-56 shrink-0">
            {allImages.length > 0 ? (
              <>
                <img
                  src={allImages[imgIndex]}
                  alt={event.title}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightbox(allImages[imgIndex])}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2a2a2a] via-transparent to-transparent pointer-events-none" />
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIndex(i => (i - 1 + allImages.length) % allImages.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-all"
                    >
                      <ChevronLeft size={16} className="text-white" />
                    </button>
                    <button
                      onClick={() => setImgIndex(i => (i + 1) % allImages.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-all"
                    >
                      <ChevronRight size={16} className="text-white" />
                    </button>
                    <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5">
                      {allImages.map((_, i) => (
                        <button key={i} onClick={() => setImgIndex(i)}
                          className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-[#FFE2A0] w-4' : 'bg-white/40 w-1.5'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-[#333] flex items-center justify-center text-[#FBFAF8]/20">
                <CalendarDays size={40} />
              </div>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-all z-10"
            >
              <X size={16} className="text-white" />
            </button>

            {/* Date badge */}
            {event.date_range && (
              <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-[#FFE2A0]/90 backdrop-blur-md rounded-full shadow-lg">
                <span className="text-[#222222] text-[10px] font-black tracking-wider uppercase">{event.date_range}</span>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            <div>
              <h2 className="text-[#FBFAF8] font-['Playfair_Display'] font-bold text-2xl leading-tight mb-1">{event.title}</h2>
              <span className="inline-flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                Pending Review
              </span>
            </div>

            <div className="border-t border-white/10" />

            {/* Info */}
            <div className="flex flex-col gap-3">
              {event.location && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                    <MapPin size={14} className="text-[#FFE2A0]" />
                  </div>
                  <div>
                    <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Location</p>
                    <p className="text-[#FBFAF8] text-sm">{event.location}</p>
                  </div>
                </div>
              )}
              {event.time && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                    <Clock size={14} className="text-[#FFE2A0]" />
                  </div>
                  <div>
                    <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Time</p>
                    <p className="text-[#FBFAF8] text-sm">{event.time}</p>
                  </div>
                </div>
              )}
              {event.date_range && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                    <CalendarDays size={14} className="text-[#FFE2A0]" />
                  </div>
                  <div>
                    <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold">Date</p>
                    <p className="text-[#FBFAF8] text-sm">{event.date_range}</p>
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <>
                <div className="border-t border-white/10" />
                <div>
                  <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Description</p>
                  <p className="text-[#FBFAF8]/70 text-sm leading-relaxed">{event.description}</p>
                </div>
              </>
            )}

            {/* Map */}
            {hasMap && (
              <>
                <div className="border-t border-white/10" />
                <div>
                  <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold mb-3">Location Map</p>
                  <MiniMap lat={event.lat as number} lng={event.lng as number} />
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${event.lat}&mlon=${event.lng}&zoom=17`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-2 text-[#FFE2A0] text-xs hover:underline"
                  >
                    <MapPin size={11} /> Open in Maps
                  </a>
                </div>
              </>
            )}

            {/* Photo strip */}
            {allImages.length > 1 && (
              <>
                <div className="border-t border-white/10" />
                <div>
                  <p className="text-[#FBFAF8]/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Photos</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {allImages.map((src, i) => (
                      <button key={i} onClick={() => setImgIndex(i)}
                        className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === imgIndex ? 'border-[#FFE2A0]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Action buttons */}
            <div className="border-t border-white/10 pt-2 flex gap-3">
              <button
                onClick={() => onApprove(event.id)}
                disabled={actionLoading === event.id}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600/80 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 border border-green-500/30 shadow-lg"
              >
                <CheckCircle size={16} /> Approve Event
              </button>
              <button
                onClick={() => onReject(event.id)}
                disabled={actionLoading === event.id}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 border border-red-600/30 shadow-lg"
              >
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Listing Card (clickable) ──────────────────────────────────────────────────

function ListingCard({
  listing,
  onApprove,
  onReject,
  actionLoading,
  onImageClick,
}: {
  listing: Listing;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  actionLoading: number | null;
  onImageClick: (src: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const handleApprove = (id: number) => { onApprove(id); setShowModal(false); };
  const handleReject = (id: number) => { onReject(id); setShowModal(false); };

  return (
    <>
      <div
        className="bg-[#333333] border border-zinc-800/50 rounded-xl p-5 sm:p-6 flex flex-col gap-5 hover:border-[#FFE2A0]/20 transition-colors cursor-pointer group"
        onClick={() => setShowModal(true)}
      >
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="relative shrink-0">
            <ImageCarousel images={listing.images} onImageClick={(src) => { onImageClick(src); }} />
            <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center pointer-events-none">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-3 py-1.5 flex items-center gap-1.5">
                <Eye size={13} className="text-[#FFE2A0]" />
                <span className="text-[#FFE2A0] text-xs font-semibold">View Details</span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 text-left w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-[#FBFAF8] font-['Playfair_Display'] truncate w-full sm:w-auto">{listing.name}</h3>
              <span className="w-fit text-[9px] font-bold uppercase tracking-widest text-[#FFE2A0] border border-[#FFE2A0]/20 bg-[#FFE2A0]/5 px-2 py-0.5 rounded shrink-0">
                {listing.category}
              </span>
            </div>
            <div className="flex items-center justify-start gap-1.5 text-[#FBFAF8]/50 text-xs mb-1">
              <MapPin size={12} /> {listing.location}
            </div>
            {listing.hours && (
              <div className="flex items-center justify-start gap-1.5 text-[#FBFAF8]/50 text-xs mb-2">
                <Clock size={12} /> {listing.hours}
              </div>
            )}
            {/* Private info shown subtly on card */}
            {listing.phone && (
              <div className="flex items-center gap-1.5 text-[#FBFAF8]/30 text-xs mb-1">
                <Lock size={10} className="text-amber-500/60" />
                <span>📞 {listing.phone}</span>
              </div>
            )}
            {listing.email && (
              <div className="flex items-center gap-1.5 text-[#FBFAF8]/30 text-xs mb-1">
                <Lock size={10} className="text-amber-500/60" />
                <span>✉️ {listing.email}</span>
              </div>
            )}
            <p className="text-[#FBFAF8]/50 text-sm line-clamp-2 mt-2 leading-relaxed hidden sm:block">{listing.description}</p>
          </div>

          <div className="flex flex-row sm:flex-col gap-2 w-full sm:min-w-[130px] sm:w-auto" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onApprove(listing.id)}
              disabled={actionLoading === listing.id}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600/80 hover:bg-green-500 disabled:opacity-40 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all active:scale-95 border border-green-500/30 shadow-lg"
            >
              <CheckCircle size={14} /> Approve
            </button>
            <button
              onClick={() => onReject(listing.id)}
              disabled={actionLoading === listing.id}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-40 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all active:scale-95 border border-red-600/30 shadow-lg"
            >
              <XCircle size={14} /> Reject
            </button>
          </div>
        </div>

        {/* Verification docs on card — uses signed URL DocThumb */}
        {(listing.business_permit || listing.government_id || listing.selfie_verification) && (
          <div className="border-t border-zinc-800 pt-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={10} className="text-amber-400/70" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400/70">
                Verification Documents
              </p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {listing.business_permit && <DocThumb src={listing.business_permit} label="Permit" onImageClick={onImageClick} />}
              {listing.government_id && <DocThumb src={listing.government_id} label="Gov ID" onImageClick={onImageClick} />}
              {listing.selfie_verification && <DocThumb src={listing.selfie_verification} label="Selfie" onImageClick={onImageClick} />}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ListingDetailModal
          listing={listing}
          onClose={() => setShowModal(false)}
          onApprove={handleApprove}
          onReject={handleReject}
          actionLoading={actionLoading}
        />
      )}
    </>
  );
}

// ── Pending Event Card (clickable) ────────────────────────────────────────────

function PendingEventCard({
  event,
  onApprove,
  onReject,
  actionLoading,
  onImageClick,
}: {
  event: PendingEvent;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  actionLoading: number | null;
  onImageClick: (src: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const handleApprove = (id: number) => { onApprove(id); setShowModal(false); };
  const handleReject = (id: number) => { onReject(id); setShowModal(false); };

  return (
    <>
      <div
        className="bg-[#333333] border border-zinc-800/50 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4 sm:gap-6 hover:border-[#FFE2A0]/20 transition-colors cursor-pointer group"
        onClick={() => setShowModal(true)}
      >
        {/* Image */}
        <div className="relative shrink-0 w-full sm:w-auto">
          {event.image_url ? (
            <div className="relative w-full sm:w-40 h-48 sm:h-28 rounded-xl overflow-hidden border border-zinc-800">
              <img src={event.image_url} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-3 py-1.5 flex items-center gap-1.5">
                  <Eye size={13} className="text-[#FFE2A0]" />
                  <span className="text-[#FFE2A0] text-xs font-semibold">View</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full sm:w-40 h-48 sm:h-28 rounded-xl bg-[#2D2D2D] border border-zinc-800 flex items-center justify-center text-[#FBFAF8]/20">
              <CalendarDays size={28} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 text-left w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
            <h3 className="text-base font-semibold text-[#FBFAF8] font-['Playfair_Display'] truncate w-full sm:w-auto">{event.title}</h3>
            <span className="w-fit text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0 font-medium">
              Pending Review
            </span>
          </div>
          {event.location && (
            <div className="flex items-center justify-start gap-1.5 text-[#FBFAF8]/50 text-xs mb-1">
              <MapPin size={12} /> {event.location}
            </div>
          )}
          {event.time && (
            <div className="flex items-center justify-start gap-1.5 text-[#FBFAF8]/50 text-xs mb-1">
              <Clock size={12} /> {event.time}
            </div>
          )}
          {event.date_range && (
            <div className="flex items-center justify-start gap-1.5 text-[#FBFAF8]/50 text-xs mb-2">
              <CalendarDays size={12} /> {event.date_range}
            </div>
          )}
          {event.description && (
            <p className="text-[#FBFAF8]/40 text-sm line-clamp-2 leading-relaxed hidden sm:block">{event.description}</p>
          )}
        </div>

        <div className="flex flex-row sm:flex-col gap-2 w-full sm:min-w-[130px] sm:w-auto" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onApprove(event.id)}
            disabled={actionLoading === event.id}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600/80 hover:bg-green-500 disabled:opacity-40 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all active:scale-95 border border-green-500/30"
          >
            <CheckCircle size={14} /> Approve
          </button>
          <button
            onClick={() => onReject(event.id)}
            disabled={actionLoading === event.id}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-40 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all active:scale-95 border border-red-600/30"
          >
            <XCircle size={14} /> Reject
          </button>
        </div>
      </div>

      {showModal && (
        <EventDetailModal
          event={event}
          onClose={() => setShowModal(false)}
          onApprove={handleApprove}
          onReject={handleReject}
          actionLoading={actionLoading}
        />
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function AdminDashboard() {
  useAdminGuard();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'listings' | 'events'>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [listingsRes, eventsRes] = await Promise.all([
      supabase.from('listings').select('*').eq('verified', false).order('created_at', { ascending: false }),
      supabase.from('events').select('*').eq('verified', false).order('created_at', { ascending: false }),
    ]);
    if (!listingsRes.error && listingsRes.data) setListings(listingsRes.data);
    if (!eventsRes.error && eventsRes.data) setEvents(eventsRes.data);
    setLoading(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApproveListing = async (id: number) => {
    setActionLoading(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/listings/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ listing_id: id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? 'Approval failed');

      const emailNote = json.email_sent ? ' Email sent to owner.' : ' (No email on file.)';
      showToast(`Listing approved!${emailNote}`, 'success');
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      showToast(err.message ?? 'Failed to approve listing.', 'error');
    }
    setActionLoading(null);
  };

  const handleRejectListing = async (id: number) => {
    setActionLoading(id);
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) showToast('Failed to reject listing.', 'error');
    else { showToast('Listing rejected and removed.', 'success'); setListings(prev => prev.filter(l => l.id !== id)); }
    setActionLoading(null);
  };

  const handleApproveEvent = async (id: number) => {
    setActionLoading(id);
    const { error } = await supabase.from('events').update({ verified: true }).eq('id', id);
    if (error) showToast('Failed to approve event.', 'error');
    else { showToast('Event approved and published!', 'success'); setEvents(prev => prev.filter(e => e.id !== id)); }
    setActionLoading(null);
  };

  const handleRejectEvent = async (id: number) => {
    setActionLoading(id);
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) showToast('Failed to reject event.', 'error');
    else { showToast('Event rejected and removed.', 'success'); setEvents(prev => prev.filter(e => e.id !== id)); }
    setActionLoading(null);
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('admin_auth');
    await supabase.auth.signOut();
    navigate(ROUTES.SIGN_IN);
  };

  const activeCount = activeTab === 'listings' ? listings.length : events.length;

  return (
    <div className="min-h-screen bg-[#2a2a2a] text-[#FBFAF8]">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* Header */}
      <div className="bg-[#333333] border-b border-zinc-800/50 px-5 sm:px-10 py-5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-sm">
        <div>
          <h1 className="font-['Playfair_Display'] text-xl sm:text-2xl font-bold text-[#FFE2A0] tracking-wide">
            Salangi Admin
          </h1>
          <p className="text-[#FBFAF8]/40 text-[10px] sm:text-xs mt-0.5">Approval Dashboard</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-[#FBFAF8]/50 hover:text-[#FFE2A0] transition-colors text-xs sm:text-sm font-medium group"
        >
          <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      <div className="px-6 md:px-10 py-8">

        {/* Summary stat pills */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8">
          <div className="flex-1 flex items-center gap-2 bg-[#333333] border border-zinc-800/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 min-w-[140px]">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[#FBFAF8]/60 text-[10px] sm:text-xs">Listings</span>
            <span className="text-[#FFE2A0] text-xs sm:text-sm font-bold ml-auto">{listings.length}</span>
          </div>
          <div className="flex-1 flex items-center gap-2 bg-[#333333] border border-zinc-800/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 min-w-[140px]">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[#FBFAF8]/60 text-[10px] sm:text-xs">Events</span>
            <span className="text-[#FFE2A0] text-xs sm:text-sm font-bold ml-auto">{events.length}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 sm:gap-2 bg-[#3a3a3a] border border-[#4d4d4d] rounded-xl p-1.5 sm:p-2 w-full sm:w-fit mb-8">
          {(['listings', 'events'] as const).map((tab) => {
            const count = tab === 'listings' ? listings.length : events.length;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 rounded-lg text-[13px] sm:text-sm font-semibold transition-all capitalize ${
                  isActive
                    ? 'bg-[#FFE2A0] text-[#1a1a1a] shadow-md scale-[1.02]'
                    : 'text-[#FBFAF8]/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
                {count > 0 && (
                  <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-[#1a1a1a]/20 text-[#1a1a1a]' : 'bg-[#FFE2A0]/20 text-[#FFE2A0]'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="font-['Playfair_Display'] text-white text-xl font-semibold">
              Pending{' '}
              <span className="text-[#FFE2A0]">{activeTab === 'listings' ? 'Listings' : 'Events'}</span>
            </h2>
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
              {activeCount} pending
            </span>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 text-xs text-[#FBFAF8]/40 hover:text-[#FFE2A0] transition-colors font-medium"
          >
            <span className="text-base leading-none">↻</span> Refresh
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-[#FBFAF8]/40">
            <svg className="animate-spin h-6 w-6 text-[#FFE2A0]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading...
          </div>
        ) : activeTab === 'listings' ? (
          listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
              <div className="bg-[#474133] p-5 rounded-full border border-[#5a5241] shadow-inner">
                <CheckCircle size={36} className="text-[#FFE2A0] opacity-60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-white text-lg font-semibold font-['Playfair_Display'] tracking-wide">All listings are verified!</h3>
                <p className="text-[#FBFAF8]/40 text-sm">No pending listing approvals.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              {listings.map(listing => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onApprove={handleApproveListing}
                  onReject={handleRejectListing}
                  actionLoading={actionLoading}
                  onImageClick={setLightbox}
                />
              ))}
            </div>
          )
        ) : (
          events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
              <div className="bg-[#474133] p-5 rounded-full border border-[#5a5241] shadow-inner">
                <CalendarDays size={36} className="text-[#FFE2A0] opacity-60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-white text-lg font-semibold font-['Playfair_Display'] tracking-wide">No pending events!</h3>
                <p className="text-[#FBFAF8]/40 text-sm">All submitted events have been reviewed.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {events.map(event => (
                <PendingEventCard
                  key={event.id}
                  event={event}
                  onApprove={handleApproveEvent}
                  onReject={handleRejectEvent}
                  actionLoading={actionLoading}
                  onImageClick={setLightbox}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold shadow-2xl border transition-all z-50 ${
          toast.type === 'success'
            ? 'bg-[#333333] border-green-500/30 text-green-400'
            : 'bg-[#333333] border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;