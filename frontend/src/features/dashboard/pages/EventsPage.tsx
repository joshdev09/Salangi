import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import EventCard from '../components/EventCard';
import { Calendar, X, Check } from 'lucide-react';
import searchIconDefault from '@assets/icons/search-btn-default.svg';
import searchIconHover from '@assets/icons/search-btn-hover.svg';

interface PublicEvent {
  id: number;
  title: string;
  description: string;
  date: string;
  date_raw: string;
  date_range: string;
  time: string;
  location: string;
  image_url: string;
  verified: boolean;
  status?: string;
  listing_id: number | null;
  organizer?: string;
  interest_count?: number;
}

const FILTERS = ['All', 'Today', 'This Week', 'This Month', 'Pick a Date'];

// ─── Date Picker Modal ────────────────────────────────────────────────────────
function DatePickerModal({
  isOpen,
  currentDate,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  currentDate: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const [tempDate, setTempDate] = useState(currentDate);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync tempDate when modal opens
  useEffect(() => {
    if (isOpen) setTempDate(currentDate);
  }, [isOpen, currentDate]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dateObj = tempDate ? new Date(tempDate + 'T12:00:00') : null;
  const isDateInvalid = tempDate ? (isNaN(dateObj?.getTime() ?? NaN) || (dateObj?.getFullYear() ?? 0) > 9999) : false;

  const formattedDisplay = tempDate
    ? isDateInvalid
      ? 'Invalid Date'
      : dateObj?.toLocaleDateString('default', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        })
    : null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.15s ease' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: brightness(0) invert(1) !important; cursor: pointer; }
      `}</style>

      <div
        className="relative w-full max-w-sm bg-[#242424] rounded-2xl border border-zinc-700/60 shadow-2xl overflow-hidden"
        style={{ animation: 'scaleIn 0.18s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-[#FFE2A0]" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFE2A0]/10 flex items-center justify-center">
              <Calendar size={15} className="text-[#FFE2A0]" />
            </div>
            <div>
              <h2 className="text-[#FBFAF8] text-sm font-semibold">Select a Date</h2>
              <p className="text-[#FBFAF8]/40 text-[11px] mt-0.5">Filter events by a specific day</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#333] hover:bg-[#444] text-[#FBFAF8]/50 hover:text-[#FBFAF8] transition-all"
          >
            <X size={13} />
          </button>
        </div>

        <div className="mx-6 h-px bg-white/5" />

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Native date input — styled */}
          <div className="relative">
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] hover:border-[#FFE2A0]/50 focus:border-[#FFE2A0] text-[#e8e8e8] rounded-xl px-4 py-3 text-sm outline-none transition-all cursor-pointer"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Formatted preview */}
          <div
            className={`rounded-xl px-4 py-3 border transition-all duration-200 ${
              tempDate
                ? 'bg-[#FFE2A0]/8 border-[#FFE2A0]/20'
                : 'bg-[#2a2a2a] border-[#333]'
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#FBFAF8]/30 mb-1">
              Selected
            </p>
            <p className={`text-sm font-medium transition-colors ${isDateInvalid ? 'text-red-400' : tempDate ? 'text-[#FFE2A0]' : 'text-[#FBFAF8]/20'}`}>
              {formattedDisplay ?? 'No date chosen yet'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-[#333] hover:bg-[#3a3a3a] text-[#FBFAF8]/60 hover:text-[#FBFAF8] border border-white/5 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(tempDate); }}
            disabled={!tempDate || isDateInvalid}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-[#FFE2A0] hover:bg-[#f5d47a] text-[#1a1a1a] shadow-lg"
          >
            <Check size={13} />
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function Eventspage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [pickedDate, setPickedDate] = useState('');
  const [isSearchHovered, setIsSearchHovered] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const { data: eventsData, error } = await supabase
          .from('events')
          .select('*, listings(name)')
          .or('verified.eq.true,status.eq.approved')
          .is('deleted_at', null)  
          .order('created_at', { ascending: false });

        if (error) console.error('Supabase error:', error);

        if (eventsData) {
          const eventIds = eventsData.map((e: any) => e.id);
          const { data: interestData } = await supabase
            .from('event_interests')
            .select('event_id')
            .in('event_id', eventIds);

          const interestMap: Record<number, number> = {};
          (interestData ?? []).forEach((row: any) => {
            interestMap[row.event_id] = (interestMap[row.event_id] ?? 0) + 1;
          });

          const formatted = eventsData.map((e: any) => {
            const rawDate = e.date
              ? (e.date + '').split('T')[0]
              : e.date_range
              ? e.date_range.split(' to ')[0].trim()
              : '';
            return {
              ...e,
              image: e.image_url,
              date_raw: rawDate,
              date: e.date_range || e.date,
              organizer: e.listings?.name ?? 'Local Organizer',
              interest_count: interestMap[e.id] ?? 0,
            };
          });
          setEvents(formatted);
        }
      } catch (err) {
        console.error('Events fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

    return events.filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.location ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.organizer ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const rawDate = e.date_raw ?? '';

      if (activeFilter === 'All') return true;
      if (activeFilter === 'Today') return rawDate === todayStr;
      if (activeFilter === 'This Week') return rawDate >= todayStr && rawDate <= endOfWeekStr;
      if (activeFilter === 'This Month') return rawDate >= todayStr && rawDate <= endOfMonthStr;
      if (activeFilter === 'Pick a Date') return pickedDate ? rawDate === pickedDate : true;

      return true;
    });
  }, [events, searchQuery, activeFilter, pickedDate]);

  return (
    <div className="relative w-full h-full bg-[#1A1A1A] text-[#FBFAF8] overflow-hidden">

      <DatePickerModal
        isOpen={isDateModalOpen}
        currentDate={pickedDate}
        onConfirm={(date) => {
          setPickedDate(date);
          setIsDateModalOpen(false);
        }}
        onClose={() => setIsDateModalOpen(false)}
      />

      {/* Radial glow */}
      <div
        className="absolute top-0 left-0 rounded-full blur-3xl opacity-60 pointer-events-none hidden md:block"
        style={{
          width: '760px',
          height: '680px',
          transform: 'translate(-400px, -440px)',
          background: 'radial-gradient(circle, rgba(255,226,160,0.8) 0%, rgba(255,226,160,0.2) 50%, transparent 70%)',
        }}
      />

      <div className="relative z-10 h-full flex flex-col px-4 py-4 md:px-6 md:py-6 overflow-y-auto no-scrollbar">

        {/* Header Section */}
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="font-['Playfair_Display'] text-2xl md:text-3xl leading-tight mb-1">
              Upcoming <span className="text-[#FFE2A0]">Events</span>
            </h1>
            <p className="text-[#FBFAF8]/50 text-sm">Discover what's happening around Pampanga.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <div 
              onMouseEnter={() => setIsSearchHovered(true)}
              onMouseLeave={() => setIsSearchHovered(false)}
              className="relative w-full sm:w-64 lg:w-72 group"
            >
              <img 
                src={isSearchHovered ? searchIconHover : searchIconDefault} 
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-all" 
                alt="search"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, venues..."
                className="w-full bg-[#2D2D2D] text-gray-200 placeholder-gray-500 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all border border-zinc-700/50 group-hover:border-[#FFE2A0] focus:border-[#FFE2A0] focus:ring-0 shadow-sm"
              />
            </div>

            <div className="flex flex-nowrap items-center gap-1.5 bg-[#2E2E2E] p-1.5 rounded-2xl sm:rounded-xl border border-[#3a3a3a] overflow-x-auto scrollbar-hide no-scrollbar">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setActiveFilter(f);
                    if (f === 'Pick a Date') {
                      setIsDateModalOpen(true);
                    } else {
                      setPickedDate('');
                    }
                  }}
                  className={`flex-none px-4 sm:px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                    activeFilter === f
                      ? 'bg-[#FFE2A0] text-[#1a1a1a] font-bold shadow-md'
                      : 'text-[#FBFAF8]/60 hover:text-[#FBFAF8] hover:bg-white/5'
                  }`}
                >
                  {f === 'Pick a Date' && <Calendar size={14} />}
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active date badge */}
        {activeFilter === 'Pick a Date' && pickedDate && (
          <div className="shrink-0 flex items-center justify-center sm:justify-end gap-3 mb-6">
            <button
              onClick={() => setIsDateModalOpen(true)}
              className="flex items-center gap-2 bg-[#2E2E2E] border border-[#FFE2A0]/30 hover:border-[#FFE2A0]/60 rounded-xl px-4 py-2.5 cursor-pointer transition-all group"
            >
              <Calendar size={14} className="text-[#FFE2A0]/70 shrink-0" />
              <span className="text-sm text-[#FFE2A0] font-medium select-none">
                {new Date(pickedDate + 'T12:00:00').toLocaleDateString('default', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </span>
              <span className="text-[10px] text-[#FBFAF8]/30 group-hover:text-[#FBFAF8]/50 transition-colors">change</span>
            </button>
            <button
              onClick={() => { setPickedDate(''); }}
              className="flex items-center gap-1.5 text-[#FBFAF8]/40 hover:text-[#FFE2A0] text-xs transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        )}

        {/* Prompt to pick when no date chosen yet */}
        {activeFilter === 'Pick a Date' && !pickedDate && (
          <div className="shrink-0 flex items-center justify-center sm:justify-end mb-6">
            <button
              onClick={() => setIsDateModalOpen(true)}
              className="flex items-center gap-2 bg-[#2E2E2E] border border-dashed border-[#444] hover:border-[#FFE2A0]/50 rounded-xl px-4 py-2.5 cursor-pointer transition-all text-[#FBFAF8]/40 hover:text-[#FFE2A0] text-sm"
            >
              <Calendar size={14} className='text-white'/>
              Choose a date
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg className="animate-spin h-6 w-6 mb-4 text-[#FFE2A0]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-[#FBFAF8]/40 text-sm animate-pulse">Loading events...</p>
          </div>
        ) : filteredEvents.length > 0 ? (
          <>
            <p className="text-[#FBFAF8]/30 text-xs mb-4 shrink-0">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 pb-10">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={{
                    ...event,
                    image: event.image_url,
                    interest_count: event.interest_count ?? 0,
                  } as any}
                  isBusinessSide={false}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="bg-[#2E2E2E] p-5 rounded-full border border-[#3a3a3a]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="size-10 text-[#FFE2A0]/60">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-[#FBFAF8]/80 font-semibold text-lg font-['Playfair_Display']">No Events Found</h3>
              <p className="text-[#FBFAF8]/40 text-sm mt-1 max-w-xs mx-auto leading-relaxed">
                {searchQuery
                  ? `No events matching "${searchQuery}".`
                  : activeFilter === 'Pick a Date' && pickedDate
                  ? `No events on ${new Date(pickedDate + 'T12:00:00').toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}.`
                  : 'No upcoming events right now. Check back soon!'}
              </p>
            </div>
            {(searchQuery || pickedDate) && (
              <button
                onClick={() => { setSearchQuery(''); setPickedDate(''); }}
                className="text-[#FFE2A0] text-xs hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Eventspage;