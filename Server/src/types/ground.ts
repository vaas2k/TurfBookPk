export interface GroundProfile {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  location: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
  images: string[];
  cover_image: string | null;
  pitch_type: string | null;
  price_per_hour: number;
  peak_percentage: number | null;
  peak_windows: { days: number[]; start_time: string; end_time: string }[];
  is_active: boolean;
  is_verified: boolean;
  rating: number;
  total_reviews: number;
  operating_hours: { open: string; close: string };
  rules: string[];
  cancellation_policy: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotProfile {
  id: string;
  ground_id: string;
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  is_booked: boolean;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}
