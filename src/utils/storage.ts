import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { BRAND } from '../brand';
import type { Booking, BookingStatus, ChatMessage, ReminderLog, ShopSettings } from '../types';
import { buildReminderLogs } from './booking';

const BOOKINGS_KEY = 'wl_barber_bookings_v1';
const SETTINGS_KEY = 'wl_barber_settings_v1';
const REMINDERS_KEY = 'wl_barber_reminders_v1';
const CHATS_KEY = 'wl_barber_chats_v1';
const MY_BOOKINGS_KEY = 'wl_customer_saved_booking_ids';
const MY_PHONE_KEY = 'wl_customer_phone';

function getTodayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getSeedBookings(): Booking[] {
  const today = getTodayStr(0);
  const tomorrow = getTodayStr(1);
  return [
    {
      id: 'seed-1',
      code: 'CB-2041',
      serviceId: BRAND.services[0].id,
      serviceName: BRAND.services[0].name,
      servicePrice: BRAND.services[0].price,
      durationMinutes: BRAND.services[0].durationMinutes,
      barberId: BRAND.staff[0].id,
      barberName: BRAND.staff[0].name,
      date: today,
      time: '11:00',
      customerName: 'Damilola Peters',
      customerPhone: '+234 803 441 9021',
      depositAmount: Math.round((BRAND.services[0].price * BRAND.depositPercentage) / 100),
      paystackRef: 'PSK-SEED-2041',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-2',
      code: 'CB-3819',
      serviceId: BRAND.services[1].id,
      serviceName: BRAND.services[1].name,
      servicePrice: BRAND.services[1].price,
      durationMinutes: BRAND.services[1].durationMinutes,
      barberId: BRAND.staff[1].id,
      barberName: BRAND.staff[1].name,
      date: today,
      time: '14:00',
      customerName: 'Kelechi Nwosu',
      customerPhone: '+234 809 112 3344',
      depositAmount: Math.round((BRAND.services[1].price * BRAND.depositPercentage) / 100),
      paystackRef: 'PSK-SEED-3819',
      status: 'completed',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-3',
      code: 'CB-5512',
      serviceId: BRAND.services[0].id,
      serviceName: BRAND.services[0].name,
      servicePrice: BRAND.services[0].price,
      durationMinutes: BRAND.services[0].durationMinutes,
      barberId: BRAND.staff[0].id,
      barberName: BRAND.staff[0].name,
      date: tomorrow,
      time: '10:30',
      customerName: 'Seyi Balogun',
      customerPhone: '+234 812 778 9900',
      depositAmount: Math.round((BRAND.services[0].price * BRAND.depositPercentage) / 100),
      paystackRef: 'PSK-SEED-5512',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function loadBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(BOOKINGS_KEY);
    if (!raw) {
      const seed = getSeedBookings();
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as Booking[];
  } catch {
    return getSeedBookings();
  }
}

export function saveBookings(bookings: Booking[]): void {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
}

export function loadSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const defaults: ShopSettings = {
        services: BRAND.services,
        staff: BRAND.staff,
        openingHours: BRAND.openingHours,
        closedDays: BRAND.closedDays,
        blockedDates: [],
        depositPercentage: BRAND.depositPercentage,
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw) as ShopSettings;
  } catch {
    return {
      services: BRAND.services,
      staff: BRAND.staff,
      openingHours: BRAND.openingHours,
      closedDays: BRAND.closedDays,
      blockedDates: [],
      depositPercentage: BRAND.depositPercentage,
    };
  }
}

export function saveSettings(settings: ShopSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadReminders(): ReminderLog[] {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) {
      const seedBookings = loadBookings();
      const logs = seedBookings.flatMap((b) =>
        buildReminderLogs(b, BRAND.businessName, BRAND.reminders.channel as 'WhatsApp' | 'SMS')
      );
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(logs));
      return logs;
    }
    return JSON.parse(raw) as ReminderLog[];
  } catch {
    return [];
  }
}

export function saveReminders(logs: ReminderLog[]): void {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(logs));
}

// ============================================================================
// FIRESTORE REAL-TIME SYNC HELPERS
// ============================================================================

export function subscribeToBookings(
  onUpdate: (bookings: Booking[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'bookings'),
    (snapshot) => {
      if (snapshot.empty) return;
      const items = snapshot.docs.map((d) => d.data() as Booking);
      saveBookings(items);
      onUpdate(items);
    },
    () => {
      // Fallback to localStorage if Firestore rules block unauthenticated reads
    }
  );
}

export function subscribeToSettings(
  onUpdate: (settings: ShopSettings) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'settings', 'shop'),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as ShopSettings;
      saveSettings(data);
      onUpdate(data);
    },
    () => {
      // Fallback to localStorage
    }
  );
}

export async function createBookingInFirestore(
  booking: Booking,
  reminders: ReminderLog[]
): Promise<void> {
  try {
    await setDoc(doc(db, 'bookings', booking.id), booking);
    await Promise.all(
      reminders.map((r) => setDoc(doc(db, 'reminders', r.id), r))
    );
  } catch {
    // Local cache already updated
  }
}

export async function updateBookingStatusInFirestore(
  bookingId: string,
  status: BookingStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { status });
  } catch {
    // Local cache already updated
  }
}

export async function checkInBookingInFirestore(
  bookingId: string,
  checkedInAt: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { checkedInAt });
  } catch {
    // Local cache already updated
  }
}

export async function rescheduleBookingInFirestore(
  bookingId: string,
  date: string,
  time: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { date, time });
  } catch {
    // Local cache already updated
  }
}

export async function saveSettingsInFirestore(
  settings: ShopSettings
): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'shop'), settings);
  } catch {
    // Local cache already updated
  }
}

export async function markReminderSentInFirestore(
  reminderId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reminders', reminderId), { sent: true });
  } catch {
    // Local cache already updated
  }
}

export async function seedFirestoreIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    if (snap.empty) {
      const seed = loadBookings();
      await Promise.all(seed.map((b) => setDoc(doc(db, 'bookings', b.id), b)));
    }
  } catch {
    // Ignore if rules require auth
  }
}

// ============================================================================
// CUSTOMER LOCAL DEVICE MEMORY (NO CODE NEEDED ON RETURN)
// ============================================================================

export function getSavedBookingIds(): string[] {
  try {
    const raw = localStorage.getItem(MY_BOOKINGS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function rememberBookingId(bookingId: string): void {
  try {
    const current = getSavedBookingIds();
    if (!current.includes(bookingId)) {
      current.unshift(bookingId);
      localStorage.setItem(MY_BOOKINGS_KEY, JSON.stringify(current));
    }
  } catch {
    // ignore
  }
}

export function getSavedCustomerPhone(): string {
  try {
    return localStorage.getItem(MY_PHONE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomerPhone(phone: string): void {
  try {
    if (phone) localStorage.setItem(MY_PHONE_KEY, phone.trim());
  } catch {
    // ignore
  }
}

// ============================================================================
// REFUND WORKFLOW
// ============================================================================

export async function requestRefundInFirestore(
  bookingId: string,
  reason: string,
  bankDetails: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      refundStatus: 'requested',
      refundReason: reason,
      refundBankDetails: bankDetails,
      refundRequestedAt: new Date().toISOString(),
    });
  } catch {
    // Local cache updated
  }
}

export async function resolveRefundInFirestore(
  bookingId: string,
  status: 'refunded' | 'rejected',
  adminNote?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      refundStatus: status,
      refundResolvedAt: new Date().toISOString(),
      ...(adminNote ? { refundAdminNote: adminNote } : {}),
    });
  } catch {
    // Local cache updated
  }
}

// ============================================================================
// REAL-TIME IN-APP CHAT (BARBER <-> CUSTOMER)
// ============================================================================

export function loadAllChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (!raw) {
      const seed: ChatMessage[] = [
        {
          id: 'msg-seed-1',
          bookingId: 'seed-1',
          sender: 'barber',
          senderName: 'Tunde Adebayo',
          text: 'Hello Damilola! Looking forward to your Signature Skin Fade. Free customer parking is right in front of the shop.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ];
      localStorage.setItem(CHATS_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveAllChatMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export async function sendChatMessageInFirestore(message: ChatMessage): Promise<void> {
  try {
    await setDoc(doc(db, 'messages', message.id), message);
  } catch {
    // Local cache updated
  }
}

export function subscribeToAllChatMessages(
  onUpdate: (messages: ChatMessage[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'messages'),
    (snapshot) => {
      if (snapshot.empty) return;
      const items = snapshot.docs.map((d) => d.data() as ChatMessage);
      saveAllChatMessages(items);
      onUpdate(items);
    },
    () => {
      // Fallback to localStorage
    }
  );
}

