export interface BookingProfile {
  id: string;
  booking_number: string;
  player_id: string;
  vendor_id: string;
  ground_id: string;
  slot_id: string;
  ground_title: string;
  ground_address: string;
  player_name: string;
  player_phone: string | null;
  date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  platform_fee: number;
  vendor_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}