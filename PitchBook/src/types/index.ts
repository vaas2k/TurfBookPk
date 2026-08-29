export type UserRole = 'player' | 'vendor' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  city?: string;
}

export interface Ground {
  id: string;
  name: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  rating: number;
  reviews: number;
  price: number;
  images: string[];
  size: '5-a-side' | '7-a-side' | '11-a-side';
  amenities: string[];
  description: string;
  rules: string[];
  vendorId: string;
  isActive: boolean;
  operatingHours: {
    open: string;
    close: string;
  };
}

export interface Pitch {
  id: string;
  groundId: string;
  name: string;
  size: '5-a-side' | '7-a-side' | '11-a-side';
  pricePerHour: number;
  peakPrice?: number;
  availability: Slot[];
}

export interface Slot {
  id: string;
  pitchId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isBlocked: boolean;
  bookedBy?: string;
  price: number;
}

export interface Booking {
  id: string;
  groundId: string;
  pitchId: string;
  slotId: string;
  playerId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  commission: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
  receiptCode: string;
}

export interface Review {
  id: string;
  groundId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
  isFlagged: boolean;
}