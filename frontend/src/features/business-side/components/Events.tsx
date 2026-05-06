import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import EventPostModal from "./PostEventModal";
import type { Event } from "../../Data/Events";
import EventCard from "../../dashboard/components/EventCard";
import SkeletonEventCard from "../../dashboard/components/SkeletonEventCard";
import { supabase } from "../../../lib/supabase";
import { BusinessFilterDropdown } from "./BusinessFilterDropdown";

interface SupabaseEvent {
  id: number;
  title: string;
  description: string;
  date_range: string;
  time: string;
  location: string;
  month: string;
  day: string;
  image_url: string;
  images: string[];
  verified: boolean;
  user_id: string;
  listing_id: number | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  interest_count?: number;
  links?: { label: string; url: string; isPrimary?: boolean }[];
}

export default function Events() {
  const [events, setEvents]           = useState<SupabaseEvent[]>([]);
  const [userListings, setUserListings] = useState<{ id: number; name: string; location: string }[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingEvent, setEditingEvent] = useState<SupabaseEvent | null>(null);
  const [loading, setLoading]           = useState(true);
  const [isModalOpen, setIsModalOpen]   = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: listings } = await supabase
        .from("listings")
        .select("id, name, location")
        .eq("user_id", user.id);

      setUserListings(listings ?? []);

      const { data: eventsData } = await supabase
        .from("events")
        .select("*")                   // includes images & links columns
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!eventsData) { setLoading(false); return; }

      // Fetch interest counts
      const eventIds = eventsData.map((e: any) => e.id);
      const { data: interestData } = await supabase
        .from("event_interests")
        .select("event_id")
        .in("event_id", eventIds);

      const interestMap: Record<number, number> = {};
      (interestData ?? []).forEach((row: any) => {
        interestMap[row.event_id] = (interestMap[row.event_id] ?? 0) + 1;
      });

      const eventsWithCounts = eventsData.map((e: any) => ({
        ...e,
        images: e.images ?? [],
        links:  e.links  ?? [],
        interest_count: interestMap[e.id] ?? 0,
      }));

      setEvents(eventsWithCounts as any);
    } catch (err) {
      console.error("Events fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const filteredEvents = events.filter(e => {
    const matchesListing = activeFilter === "All" || userListings.find(l => l.id === e.listing_id)?.name === activeFilter;
    const matchesStatus  =
      statusFilter === "All" ||
      (statusFilter === "Approved" && e.verified) ||
      (statusFilter === "Pending"  && !e.verified);
    return matchesListing && matchesStatus;
  });

  const handleEdit   = (event: SupabaseEvent) => { setEditingEvent(event); setIsModalOpen(true); };
  const handleDelete = async (eventId: number) => {
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (!error) setEvents(prev => prev.filter(e => e.id !== eventId));
  };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingEvent(null); };
  const handleAddEvent   = (newEvent: any) => {
    setEvents(prev => {
      const exists = prev.find(e => e.id === newEvent.id);
      if (exists) {
        // update in place (edit flow)
        return prev.map(e => e.id === newEvent.id ? { ...e, ...newEvent } : e);
      }
      return [{ ...newEvent, images: newEvent.images ?? [], links: newEvent.links ?? [], interest_count: 0 }, ...prev];
    });
  };

  const totalInterests = filteredEvents.reduce((sum, e) => sum + (e.interest_count ?? 0), 0);

  return (
    <div className="w-full h-full pb-10">
      <div className="px-4 md:px-6 py-4">

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-0">
          <div className="mb-4">
            <h1 className="font-['Playfair_Display'] text-white text-3xl font-semibold tracking-wide cursor-default">
              Business <span className="text-[#FFE2A0]">Events</span>
            </h1>
            <p className="text-white text-sm">Create and manage your upcoming promotional events</p>
          </div>
          <BusinessFilterDropdown
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            listings={userListings}
          />
        </div>

        {/* Post Event button + total interests */}
        <div className="flex flex-row flex-wrap gap-4 mt-6 items-center">
          <button
            onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}
            className="p-3 w-54 h-18 rounded-xl flex flex-row items-center gap-3 bg-[#5a5241] hover:bg-[#857657] border border-[#FFE2A0] text-[#fdfdfd] text-md tracking-wide cursor-pointer text-left transition-all shadow-lg active:scale-95"
          >
            <div className="p-3 h-12 w-12 flex justify-center items-center bg-[#474133] rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold">Post Event</span>
              <span className="text-xs text-[#FFE2A0] opacity-80">Create new event</span>
            </div>
          </button>

          <div className="flex items-center gap-3 bg-[#3a3a3a] border border-[#4d4d4d] rounded-2xl px-5 py-3 shadow-lg hover:border-[#FFE2A0]/30 transition-all group cursor-default">
            <div className="p-2 bg-[#FFE2A0]/10 rounded-xl group-hover:bg-[#FFE2A0]/20 transition-colors">
              <Heart size={18} fill="#FFE2A0" className="text-[#FFE2A0]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-white text-lg font-bold font-['Playfair_Display'] leading-none">
                {loading ? "..." : totalInterests}
              </span>
              <span className="text-[#a0a0a0] text-[10px] uppercase tracking-widest font-bold mt-1">Total interests</span>
            </div>
          </div>
        </div>

        {/* Your Events heading + filters */}
        <div className="mt-12 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[#FFE2A0] text-xl font-['Playfair_Display'] font-semibold">Your Events</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-600/20 text-green-400 border border-green-600/30 px-2 py-0.5 rounded-full font-medium">
                {events.filter(e => e.verified).length} Approved
              </span>
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                {events.filter(e => !e.verified).length} Pending
              </span>
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 bg-[#3a3a3a] p-1.5 rounded-xl border border-[#4d4d4d] w-full sm:w-fit overflow-x-auto scrollbar-hide">
            {["All", "Approved", "Pending"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-[#FFE2A0] text-[#1a1a1a] shadow-md font-semibold'
                    : 'text-white hover:bg-white/5'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Event list */}
        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6 mb-8">
              {[0, 1, 2].map((i) => <SkeletonEventCard key={i} />)}
            </div>
          ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6 mb-8">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative">
                {/* Status badge */}
                {event.verified ? (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Approved
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                    Pending Review
                  </div>
                )}

                <EventCard
                  event={{
                    ...event,
                    image:    event.image_url,
                    images:   event.images ?? [],
                    links:    event.links  ?? [],
                    date:     event.date_range,
                    organizer: userListings.find(l => l.id === event.listing_id)?.name || "My Business",
                    interest_count: event.interest_count ?? 0,
                  } as any}
                  isBusinessSide={true}
                  onEdit={() => handleEdit(event)}
                  onDelete={() => handleDelete(event.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-4 py-16 mt-4 space-y-4 w-full">
            <div className="bg-[#474133] p-4 rounded-full border border-[#5a5241] shadow-inner transition-transform hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="size-10 text-[#FFE2A0]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-white text-xl font-semibold tracking-wide font-['Playfair_Display']">
                {statusFilter !== "All" ? `No ${statusFilter} Events` : "No Events Found"}
              </h3>
              <p className="text-[#a0a0a0] text-sm font-light max-w-xs mx-auto leading-relaxed">
                {statusFilter !== "All"
                  ? `You have no ${statusFilter.toLowerCase()} events yet.`
                  : "Host your first event to reach more customers and grow your community."}
              </p>
            </div>
          </div>
        )}

        <EventPostModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onAddEvent={handleAddEvent}
          editEvent={editingEvent ? {
            ...editingEvent,
            image:     editingEvent.image_url,
            images:    editingEvent.images  ?? [],
            links:     editingEvent.links   ?? [],
            organizer: userListings.find(l => l.id === editingEvent.listing_id)?.name || "My Business",
          } as any : null}
          userListings={userListings}
        />
      </div>
    </div>
  );
}