    import { supabase } from '@/lib/supabase';

export type Category = 'All' | 'Food & Drinks' | 'Shops' | 'Activities' | 'Services' | 'Stay' | 'Community & Essentials';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Listing {
  id: number;
  name: string;
  category: Exclude<Category, 'All'>;
  location: string;
  coordinates: Coordinates;
  hours: string;
  description: string;
  images: string[];
  verified: boolean;
  slug?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  website?: string;
}

export const CATEGORIES: Record<string, Category> = {
  ALL: 'All',
  FOOD: 'Food & Drinks',
  SHOPS: 'Shops',
  ACTIVITIES: 'Activities',
  SERVICES: 'Services',
  STAY: 'Stay',
  COMMUNITY: 'Community & Essentials',
};

// ─── Simple TTL cache ─────────────────────────────────────────────────────────
// Stores results in memory so repeated calls within the TTL window hit the DB
// only once. Cache is busted automatically on any write (create/update/delete).

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> { data: T; expires: number; }
const cache = new Map<string, CacheEntry<any>>();

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + TTL_MS });
}

function bustListingsCache(): void {
  for (const key of cache.keys()) {
    if (key.startsWith('listings:') || key.startsWith('ratings:')) {
      cache.delete(key);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function mapRow(row: any): Listing {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    location: row.location,
    coordinates: { lat: row.lat, lng: row.lng },
    hours: row.hours,
    description: row.description,
    images: row.images,
    verified: row.verified,
    slug: row.slug ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    facebook: row.facebook ?? undefined,
    website: row.website ?? undefined,
  };
}

export async function getListings(): Promise<Listing[]> {
  const cached = getCache<Listing[]>('listings:all');
  if (cached) return cached;

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('verified', true)
    .order('id');
  if (error) throw error;

  const result = data.map(mapRow);
  setCache('listings:all', result);
  return result;
}

export async function getListingsByCategory(category: Category): Promise<Listing[]> {
  if (category === 'All') return getListings();

  const cacheKey = `listings:category:${category}`;
  const cached = getCache<Listing[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('category', category)
    .eq('verified', true)
    .order('id');
  if (error) throw error;

  const result = data.map(mapRow);
  setCache(cacheKey, result);
  return result;
}

export async function getListingById(id: number): Promise<Listing | null> {
  const cacheKey = `listings:id:${id}`;
  const cached = getCache<Listing>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;

  const result = mapRow(data);
  setCache(cacheKey, result);
  return result;
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const cacheKey = `listings:slug:${slug}`;
  const cached = getCache<Listing>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;

  const result = mapRow(data);
  setCache(cacheKey, result);
  return result;
}

export async function createListing(listing: Omit<Listing, 'id'>): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .insert({
      name: listing.name,
      category: listing.category,
      location: listing.location,
      lat: listing.coordinates.lat,
      lng: listing.coordinates.lng,
      hours: listing.hours,
      description: listing.description,
      images: listing.images,
      verified: false,
      phone: listing.phone ?? null,
      email: listing.email ?? null,
      facebook: listing.facebook ?? null,
      website: listing.website ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  bustListingsCache();
  return mapRow(data);
}

export async function updateListing(id: number, updates: Partial<Omit<Listing, 'id'>>): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.category && { category: updates.category }),
      ...(updates.location && { location: updates.location }),
      ...(updates.coordinates && { lat: updates.coordinates.lat, lng: updates.coordinates.lng }),
      ...(updates.hours && { hours: updates.hours }),
      ...(updates.description && { description: updates.description }),
      ...(updates.images && { images: updates.images }),
      ...(updates.verified !== undefined && { verified: updates.verified }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.email !== undefined && { email: updates.email }),
      ...(updates.facebook !== undefined && { facebook: updates.facebook }),
      ...(updates.website !== undefined && { website: updates.website }),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  bustListingsCache();
  return mapRow(data);
}

export async function deleteListing(id: number): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) throw error;
  bustListingsCache();
}

export async function getAverageRatings(): Promise<Record<number, number>> {
  const cached = getCache<Record<number, number>>('ratings:all');
  if (cached) return cached;

  const { data, error } = await supabase
    .from('reviews')
    .select('listing_id, rating');
  if (error) throw error;

  const ratingsMap: Record<number, number[]> = {};
  data.forEach((row: any) => {
    if (!ratingsMap[row.listing_id]) ratingsMap[row.listing_id] = [];
    ratingsMap[row.listing_id].push(row.rating);
  });

  const averages: Record<number, number> = {};
  Object.entries(ratingsMap).forEach(([id, ratings]) => {
    averages[Number(id)] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  });

  setCache('ratings:all', averages);
  return averages;
}