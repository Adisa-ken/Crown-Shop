export type BookingStatus = 'confirmed' | 'completed' | 'no-show' | 'cancelled';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
}

export interface OpeningHours {
  start: string; // "09:00"
  end: string;   // "20:00"
  slotIntervalMinutes: number;
}

export interface Booking {
  id: string;
  code: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  durationMinutes: number;
  barberId: string;
  barberName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerName: string;
  customerPhone: string;
  depositAmount: number;
  paystackRef: string;
  status: BookingStatus;
  checkedInAt?: string;
  refundStatus?: 'none' | 'requested' | 'refunded' | 'rejected';
  refundReason?: string;
  refundBankDetails?: string;
  refundRequestedAt?: string;
  refundResolvedAt?: string;
  refundAdminNote?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  sender: 'customer' | 'barber';
  senderName: string;
  text: string;
  createdAt: string;
}

export interface ReminderLog {
  id: string;
  bookingId: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  type: '24h_before' | '2h_before' | 'thank_you';
  channel: 'WhatsApp' | 'SMS';
  message: string;
  scheduledFor: string;
  sent: boolean;
}

export interface ReminderTemplates {
  before24h: string;
  before2h: string;
  thankYou: string;
}

export interface ShopSettings {
  services: Service[];
  staff: StaffMember[];
  openingHours: OpeningHours;
  closedDays: number[];
  blockedDates: string[]; // YYYY-MM-DD
  depositPercentage: number;
  allowPayOnArrival?: boolean;
  accentColor?: string;
  reminderTemplates?: ReminderTemplates;
}
