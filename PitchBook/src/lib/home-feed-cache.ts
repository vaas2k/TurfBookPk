import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ground } from "@/lib/api/vendors";

const CACHE_KEY = "turfbookpk.player-home-feed.v1";
const GROUND_DETAIL_CACHE_KEY = "turfbookpk.public-ground-details.v1";

export type CachedHomeGround = {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  slotsAvailable: number;
  image: string;
  type: string;
  distance: string;
  distanceKm: number | null;
  isAvailableNow: boolean;
};

type HomeFeedCache = {
  userId: string;
  date: string;
  city: string;
  grounds: CachedHomeGround[];
  recent: Ground[];
  savedAt: number;
};

let memoryCache: HomeFeedCache | null = null;
let groundDetailCache: Record<string, Ground> | null = null;

export async function preloadHomeFeedCache(): Promise<void> {
  if (memoryCache) return;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    memoryCache = raw ? (JSON.parse(raw) as HomeFeedCache) : null;
  } catch {
    memoryCache = null;
  }
}

export async function getHomeFeedCache(userId: string, date: string): Promise<HomeFeedCache | null> {
  await preloadHomeFeedCache();
  if (!memoryCache || memoryCache.userId !== userId || memoryCache.date !== date) return null;
  return memoryCache;
}

export async function saveHomeFeedCache(cache: Omit<HomeFeedCache, "savedAt">): Promise<void> {
  const value: HomeFeedCache = { ...cache, savedAt: Date.now() };
  memoryCache = value;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // A cache write must never affect the live marketplace response.
  }
}

export async function clearHomeFeedCache(): Promise<void> {
  memoryCache = null;
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore storage cleanup failures; the user/date guard prevents misuse.
  }
}

async function loadGroundDetailCache(): Promise<Record<string, Ground>> {
  if (groundDetailCache) return groundDetailCache;
  try {
    const raw = await AsyncStorage.getItem(GROUND_DETAIL_CACHE_KEY);
    groundDetailCache = raw ? (JSON.parse(raw) as Record<string, Ground>) : {};
  } catch {
    groundDetailCache = {};
  }
  return groundDetailCache;
}

export async function getCachedGroundDetail(id: string): Promise<Ground | null> {
  return (await loadGroundDetailCache())[id] || null;
}

export async function saveCachedGroundDetail(ground: Ground): Promise<void> {
  const items = await loadGroundDetailCache();
  items[ground.id] = ground;
  // Keep a bounded cache of public metadata; slots deliberately are not stored.
  const bounded = Object.fromEntries(Object.entries(items).slice(-30));
  groundDetailCache = bounded;
  try {
    await AsyncStorage.setItem(GROUND_DETAIL_CACHE_KEY, JSON.stringify(bounded));
  } catch {
    // Cache failures must not affect loading the live ground detail.
  }
}
