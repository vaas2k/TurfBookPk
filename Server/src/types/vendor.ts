export interface VendorProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_phone: string;
  business_city: string;
  business_description: string | null;
  business_logo: string | null;
  business_cover_image: string | null;
  is_verified: boolean;
  is_active: boolean;
  total_earnings: number;
  pending_earnings: number;
  total_withdrawn: number;
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}