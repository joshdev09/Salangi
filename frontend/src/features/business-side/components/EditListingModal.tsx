import { useState, useEffect, useRef } from "react";
import type { Listing } from "../../Data/Listings";
import { X, Plus, Trash2 } from "lucide-react";
import { supabase } from '../../../lib/supabase';
import phoneIcon from '@assets/icons/phone-icon.svg';
import emailIcon from '@assets/icons/emain-icon.svg';
import fbIcon from '@assets/icons/fb-icon.svg';
import webIcon from '@assets/icons/web-icon.svg';
import { LOCATIONS, CITY_COORDS } from '../../../constant/location';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const OPERATING_DAYS = ['Daily', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Custom Tab ────────────────────────────────────────────────────────────────

const TAB_LABEL_OPTIONS = ['None', 'Menu', 'Services', 'Rates', 'Packages'] as const;
type TabLabelValue = 'menu' | 'services' | 'rates' | 'packages';

interface TabItem {
  id?: number;
  category: string;
  name: string;
  price: string; // string so the input stays controlled
  sort_order: number;
}

const parseTimeOutput = (timeStr: string) => {
  if (!timeStr) return '';
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '';
  let [_, h, m, ampm] = match;
  let hour = parseInt(h);
  if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${m}`;
};

const formatTimeInput = (t: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=ph`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ── Draggable Map (reused from ListBusiness) ──────────────────────────────────

interface DraggableMapProps {
  lat: number; lng: number; onPinMove: (lat: number, lng: number) => void;
}

function DraggableMap({ lat, lng, onPinMove }: DraggableMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([lat, lng], 17);
      mapInstanceRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current = marker;
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onPinMove(pos.lat, pos.lng);
      });
    }
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 1 });
  }, [lat, lng]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={mapRef} style={{ height: '220px', width: '100%', borderRadius: '12px', overflow: 'hidden' }} />
      <p className="text-xs text-[#FBFAF8]/40 text-center">
        📍 Drag the pin to set the exact location of your business
      </p>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (listing: Partial<Listing>) => void;
  listing: Listing | null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EditListingModal({ isOpen, onClose, onSave, listing }: EditListingModalProps) {
  const [form, setForm] = useState({
    name: "",
    category: "Resto",
    city: "",
    barangay: "",
    street: "",
    otherDetails: "",
    lat: null as number | null,
    lng: null as number | null,
    hours: "",
    operatingDays: [] as string[],
    openingTime: "",
    closingTime: "",
    description: "",
    phone: "",
    email: "",
    facebook: "",
    website: "",
  });

  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Custom Tab state ────────────────────────────────────────────────────────
  const [tabLabel, setTabLabel] = useState<string>('None');
  const [tabEnabled, setTabEnabled] = useState(false);
  const [tabItems, setTabItems] = useState<TabItem[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const inputBaseLine = "w-full bg-[#2a2a2a] border border-[#333333] text-[#e0e0e0] rounded-lg px-4 py-2.5 text-sm focus:border-[#FFE2A0] focus:ring-1 focus:ring-[#FFE2A0]/20 outline-none transition-all duration-200";

  // ── Pre-fill form from existing listing ────────────────────────────────────
  useEffect(() => {
    if (!listing) return;

    // Parse city, barangay, street from location string
    // Location format: "street, barangay, city, Pampanga, (otherDetails)"
    let city = '';
    let barangay = '';
    let street = '';
    let otherDetails = '';

    if (listing.location) {
      const parts = listing.location.split(', ');
      // Try to match city from LOCATIONS keys
      const cityIndex = parts.findIndex(p => Object.keys(LOCATIONS).includes(p));
      if (cityIndex !== -1) {
        city = parts[cityIndex];
        barangay = parts[cityIndex - 1] ?? '';
        street = parts.slice(0, cityIndex - 1).join(', ');
        const afterCity = parts.slice(cityIndex + 2).join(', '); // skip "Pampanga"
        otherDetails = afterCity.replace(/^\(|\)$/g, '');
      } else {
        // Fallback: just use full location string as street
        street = listing.location;
      }
    }

    // Parse hours
    let operatingDays: string[] = [];
    let openingTime = '';
    let closingTime = '';

    if (listing.hours) {
      const parts = listing.hours.split(', ');
      const timePart = parts.pop() || '';
      operatingDays = parts;
      const [start, end] = timePart.split(' – ');
      openingTime = parseTimeOutput(start);
      closingTime = parseTimeOutput(end);
    }

    setForm({
      name: listing.name ?? '',
      category: listing.category ?? '',
      city,
      barangay,
      street,
      otherDetails,
      lat: listing.coordinates?.lat ?? null,
      lng: listing.coordinates?.lng ?? null,
      hours: listing.hours ?? '',
      operatingDays,
      openingTime,
      closingTime,
      description: listing.description ?? '',
      phone: listing.phone?.replace('+63', '') ?? '',
      email: listing.email ?? '',
      facebook: listing.facebook ?? '',
      website: listing.website ?? '',
    });
  }, [listing, isOpen]);

  // ── Fetch existing tab data when modal opens ────────────────────────────────
  useEffect(() => {
    if (!isOpen || !listing?.id) return;

    const fetchTabData = async () => {
      setTabLoading(true);

      const { data: tabRow } = await supabase
        .from('listing_tabs')
        .select('*')
        .eq('listing_id', listing.id)
        .maybeSingle();

      if (tabRow) {
        const label = tabRow.tab_label.charAt(0).toUpperCase() + tabRow.tab_label.slice(1);
        setTabLabel(label);
        setTabEnabled(tabRow.is_enabled);
      } else {
        setTabLabel('None');
        setTabEnabled(false);
      }

      const { data: items } = await supabase
        .from('listing_tab_items')
        .select('*')
        .eq('listing_id', listing.id)
        .order('sort_order');

      setTabItems(
        (items ?? []).map((item: any) => ({
          id: item.id,
          category: item.category,
          name: item.name,
          price: String(item.price),
          sort_order: item.sort_order,
        }))
      );

      setTabLoading(false);
    };

    fetchTabData();
  }, [isOpen, listing?.id]);
  useEffect(() => {
    if (!form.city) return;
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
    geocodeTimeout.current = setTimeout(async () => {
      setGeocoding(true);
      const attempts = [
        form.street ? `${form.street}, ${form.barangay}, ${form.city}, Pampanga, Philippines` : null,
        form.barangay ? `${form.barangay}, ${form.city}, Pampanga, Philippines` : null,
        `${form.city}, Pampanga, Philippines`,
      ].filter(Boolean) as string[];

      let coords: { lat: number; lng: number } | null = null;
      for (const address of attempts) {
        coords = await geocodeAddress(address);
        if (coords) break;
      }
      if (!coords) coords = CITY_COORDS[form.city] ?? { lat: 15.1450, lng: 120.5887 };
      setForm(prev => ({ ...prev, lat: coords!.lat, lng: coords!.lng }));
      setGeocoding(false);
    }, 800);
    return () => { if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current); };
  }, [form.street, form.barangay, form.city]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formattedHours = `${form.operatingDays.join(', ')}, ${formatTimeInput(form.openingTime)} – ${formatTimeInput(form.closingTime)}`;

    const location = [
      form.street,
      form.barangay,
      form.city,
      'Pampanga',
      form.otherDetails ? `(${form.otherDetails})` : '',
    ].filter(Boolean).join(', ');

    // ── Save tab data ─────────────────────────────────────────────────────────
    if (listing?.id) {
      const isActive = tabLabel !== 'None' && tabEnabled;
      const labelValue = tabLabel.toLowerCase() as TabLabelValue;

      if (tabLabel !== 'None') {
        await supabase
          .from('listing_tabs')
          .upsert(
            { listing_id: listing.id, tab_label: labelValue, is_enabled: isActive },
            { onConflict: 'listing_id' }
          );

        // Replace all items: delete then insert
        await supabase.from('listing_tab_items').delete().eq('listing_id', listing.id);

        const rows = tabItems
          .filter(item => item.name.trim())
          .map((item, i) => ({
            listing_id: listing.id,
            category: item.category.trim() || 'General',
            name: item.name.trim(),
            price: parseFloat(item.price) || 0,
            sort_order: i,
          }));

        if (rows.length > 0) {
          await supabase.from('listing_tab_items').insert(rows);
        }
      } else {
        // Label set to None — disable the tab
        await supabase
          .from('listing_tabs')
          .upsert(
            { listing_id: listing.id, tab_label: 'menu', is_enabled: false },
            { onConflict: 'listing_id' }
          );
      }
    }

    onSave({
      ...listing,
      ...form,
      hours: formattedHours,
      location,
      coordinates: {
        lat: form.lat ?? listing?.coordinates?.lat ?? 0,
        lng: form.lng ?? listing?.coordinates?.lng ?? 0,
      },
      phone: form.phone ? `+63${form.phone}` : '',
    } as Listing);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl bg-[#222222] rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col max-h-[90vh]">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-[#FFE2A0]" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#FFE2A0]">Edit Listing</h2>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Update your professional profile</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-hide">
          <form id="edit-listing-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Business Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Business Name</label>
                <input name="name" value={form.name} onChange={handleChange} className={inputBaseLine} placeholder="The Grand Bistro" required />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Category</label>
                <select name="category" value={form.category} onChange={handleChange} className={inputBaseLine}>
                  <option value="Food & Drinks">Food & Drinks</option>
                  <option value="Shops">Shops</option>
                  <option value="Activities">Activities</option>
                  <option value="Services">Services</option>
                  <option value="Stay">Stay</option>
                  <option value="Community & Essentials">Community & Essentials</option>
                </select>
              </div>

              {/* City */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">City</label>
                <select
                  name="city"
                  value={form.city}
                  onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value, barangay: '' }))}
                  className={inputBaseLine}
                >
                  <option value="">Select a city / municipality</option>
                  {Object.keys(LOCATIONS).map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Barangay */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Barangay</label>
                <select
                  name="barangay"
                  value={form.barangay}
                  onChange={(e) => setForm(prev => ({ ...prev, barangay: e.target.value }))}
                  className={inputBaseLine}
                  disabled={!form.city}
                >
                  <option value="">Select a barangay</option>
                  {form.city && LOCATIONS[form.city]?.map(brgy => (
                    <option key={brgy} value={brgy}>{brgy}</option>
                  ))}
                </select>
              </div>

              {/* Street */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Street / Building No.</label>
                <input name="street" value={form.street} onChange={handleChange} className={inputBaseLine} placeholder="e.g. 123 Sto. Rosario St." required />
              </div>

              {/* Other Details */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Other Details (optional)</label>
                <input name="otherDetails" value={form.otherDetails} onChange={handleChange} className={inputBaseLine} placeholder="e.g. Near SM Clark, 2nd floor" />
              </div>

              {/* Map */}
              {form.lat !== null && form.lng !== null && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Pin Location</label>
                  {geocoding && (
                    <p className="text-xs text-[#FFE2A0]/70 animate-pulse">📡 Finding location...</p>
                  )}
                  <DraggableMap
                    lat={form.lat}
                    lng={form.lng}
                    onPinMove={(lat, lng) => setForm(prev => ({ ...prev, lat, lng }))}
                  />
                  <p className="text-xs text-zinc-600">
                    Coordinates: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                  </p>
                </div>
              )}

              {/* Operating Days */}
              <div className="space-y-3 md:col-span-2">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Operating Days</label>
                <div className="flex flex-wrap gap-2">
                  {OPERATING_DAYS.map((day) => {
                    const isActive = day === 'Daily'
                      ? form.operatingDays.includes('Daily')
                      : form.operatingDays.includes(day) && !form.operatingDays.includes('Daily');
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (day === 'Daily') {
                            setForm(prev => ({ ...prev, operatingDays: prev.operatingDays.includes('Daily') ? [] : ['Daily'] }));
                          } else {
                            const without = form.operatingDays.filter(d => d !== 'Daily');
                            const toggled = without.includes(day)
                              ? without.filter(d => d !== day)
                              : [...without, day];
                            setForm(prev => ({ ...prev, operatingDays: toggled }));
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                          isActive
                            ? 'bg-[#FFE2A0] text-[#1A1A1A] border-[#FFE2A0]'
                            : 'bg-[#2D2D2D] text-[#FBFAF8]/70 border-transparent hover:border-[#FFE2A0]/40'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opening & Closing Times */}
              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Opening Time</label>
                <input type="time" name="openingTime" value={form.openingTime} onChange={handleChange} className={inputBaseLine} required />
              </div>
              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Closing Time</label>
                <input type="time" name="closingTime" value={form.closingTime} onChange={handleChange} className={inputBaseLine} required />
              </div>

              {/* Description */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={4} className={`${inputBaseLine} resize-none`} placeholder="Tell people about your business..." required />
              </div>
            </div>

            {/* Contact & Social */}
            <div className="pt-6 border-t border-zinc-800">
              <h3 className="text-xs font-bold text-[#FFE2A0] mb-6 uppercase tracking-wider">Contact & Social (optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Phone */}
                <div className="flex items-center gap-3 group">
                  <div className="w-8 flex justify-center shrink-0">
                    <img src={phoneIcon} alt="phone" className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 flex items-center bg-[#2a2a2a] rounded-lg border border-[#333333] focus-within:border-[#FFE2A0] transition-all overflow-hidden h-[42px]">
                    <span className="px-3 text-sm font-bold text-zinc-500 border-r border-zinc-800 py-3 select-none tracking-widest">+63</span>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setForm(prev => ({ ...prev, phone: digits }));
                      }}
                      placeholder="912 345 6789"
                      className="flex-1 bg-transparent text-[#e0e0e0] text-sm px-3 outline-none placeholder-zinc-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-3 group">
                  <div className="w-8 flex justify-center shrink-0">
                    <img src={emailIcon} alt="email" className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1">
                    <input name="email" value={form.email} onChange={handleChange} className={inputBaseLine} placeholder="contact@business.com" />
                  </div>
                </div>

                {/* Facebook */}
                <div className="flex items-center gap-3 group">
                  <div className="w-8 flex justify-center shrink-0">
                    <img src={fbIcon} alt="facebook" className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1">
                    <input name="facebook" value={form.facebook} onChange={handleChange} className={inputBaseLine} placeholder="facebook.com/yourbusiness" />
                  </div>
                </div>

                {/* Website */}
                <div className="flex items-center gap-3 group">
                  <div className="w-8 flex justify-center shrink-0">
                    <img src={webIcon} alt="website" className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1">
                    <input name="website" value={form.website} onChange={handleChange} className={inputBaseLine} placeholder="www.yourbusiness.com" />
                  </div>
                </div>

              </div>
            </div>
          </form>

            {/* ── Custom Tab Section ─────────────────────────────────────────── */}
            <div className="pt-6 border-t border-zinc-800 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold text-[#FFE2A0] uppercase tracking-wider">Custom Tab</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Add a Menu, Services, Rates, or Packages tab to your listing card</p>
                </div>
                {tabLabel !== 'None' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">{tabEnabled ? 'Enabled' : 'Disabled'}</span>
                    <button
                      type="button"
                      onClick={() => setTabEnabled(prev => !prev)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tabEnabled ? 'bg-[#FFE2A0]' : 'bg-zinc-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-[#1a1a1a] transition-transform ${tabEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
              </div>

              {tabLoading ? (
                <p className="text-xs text-zinc-500 animate-pulse">Loading tab data...</p>
              ) : (
                <>
                  {/* Label picker */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {TAB_LABEL_OPTIONS.map(label => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setTabLabel(label);
                          if (label === 'None') setTabEnabled(false);
                          else setTabEnabled(true);
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
                          tabLabel === label
                            ? 'bg-[#FFE2A0] text-[#1A1A1A] border-[#FFE2A0]'
                            : 'bg-[#2D2D2D] text-[#FBFAF8]/70 border-transparent hover:border-[#FFE2A0]/40'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Items list — only shown when a label is selected */}
                  {tabLabel !== 'None' && (
                    <div className="space-y-3">
                      {/* Column headers — hidden on mobile, visible on sm+ */}
                      <div className="hidden sm:grid grid-cols-[1fr_1fr_6rem_2rem] gap-2 px-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Category</span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Item Name</span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Price (₱)</span>
                        <span />
                      </div>

                      {tabItems.map((item, i) => (
                        <div key={i} className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_6rem_2rem] gap-2 sm:items-center bg-[#1e1e1e] sm:bg-transparent rounded-lg p-3 sm:p-0 border border-zinc-800 sm:border-0">
                          <div className="flex flex-col gap-1 sm:contents">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider sm:hidden">Category</label>
                            <input
                              value={item.category}
                              onChange={e => setTabItems(prev => prev.map((it, idx) => idx === i ? { ...it, category: e.target.value } : it))}
                              placeholder="e.g. Drinks"
                              className={inputBaseLine}
                            />
                          </div>
                          <div className="flex flex-col gap-1 sm:contents">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider sm:hidden">Item Name</label>
                            <input
                              value={item.name}
                              onChange={e => setTabItems(prev => prev.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it))}
                              placeholder="Item name"
                              className={inputBaseLine}
                            />
                          </div>
                          <div className="flex items-center gap-2 sm:contents">
                            <div className="flex flex-col gap-1 flex-1 sm:contents">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider sm:hidden">Price (₱)</label>
                              <input
                                value={item.price}
                                onChange={e => setTabItems(prev => prev.map((it, idx) => idx === i ? { ...it, price: e.target.value } : it))}
                                placeholder="0.00"
                                type="number"
                                min="0"
                                step="0.01"
                                className={inputBaseLine}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setTabItems(prev => prev.filter((_, idx) => idx !== i))}
                              className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors shrink-0 sm:self-auto self-end"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setTabItems(prev => [...prev, { category: '', name: '', price: '', sort_order: prev.length }])}
                        className="flex items-center gap-2 text-xs text-[#FFE2A0]/70 hover:text-[#FFE2A0] transition-colors mt-1"
                      >
                        <Plus size={14} /> Add item
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-zinc-800 flex justify-end gap-3 bg-[#1e1e1e]/50">
          <button type="button" onClick={onClose} className="px-6 py-2.5 bg-zinc-800 text-zinc-400 text-xs font-bold rounded-xl hover:bg-zinc-700 transition-all active:scale-95">
            Cancel
          </button>
          <button form="edit-listing-form" type="submit" className="px-8 py-2.5 bg-[#FFE2A0] text-[#222222] text-xs font-bold rounded-xl hover:bg-[#ffe8b5] transition-all hover:shadow-lg hover:shadow-[#FFE2A0]/10 active:scale-95">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}