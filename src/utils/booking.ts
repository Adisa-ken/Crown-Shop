import type { Booking, OpeningHours, ReminderLog, StaffMember } from '../types';

/**
 * Converts "HH:MM" into total minutes from midnight.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converts total minutes from midnight into "HH:MM".
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates the upfront deposit amount based on service price and deposit percentage.
 */
export function calculateDeposit(price: number, depositPercentage: number): number {
  if (price <= 0 || depositPercentage <= 0) return 0;
  return Math.round((price * depositPercentage) / 100);
}

/**
 * Checks if a date (YYYY-MM-DD) is closed due to weekly closedDays or owner blockedDates.
 */
export function isDateClosed(
  dateStr: string,
  closedDays: number[],
  blockedDates: string[]
): boolean {
  if (blockedDates.includes(dateStr)) return true;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  return closedDays.includes(dayOfWeek);
}

/**
 * Checks if a candidate slot [slotStart, slotStart + duration) overlaps with
 * any existing confirmed/completed booking for the same barber on that date.
 */
export function isSlotBookedForBarber(
  barberId: string,
  date: string,
  slotTime: string,
  durationMinutes: number,
  bookings: Booking[],
  excludeBookingId?: string
): boolean {
  const slotStart = timeToMinutes(slotTime);
  const slotEnd = slotStart + durationMinutes;

  return bookings.some((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (b.status === 'cancelled' || b.status === 'no-show') return false;
    if (b.date !== date || b.barberId !== barberId) return false;

    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + b.durationMinutes;
    return slotStart < bEnd && slotEnd > bStart;
  });
}

/**
 * Resolves "any" barber to the first available staff member for the given slot,
 * or returns null if all barbers are booked.
 */
export function findAvailableBarber(
  requestedBarberId: string,
  date: string,
  slotTime: string,
  durationMinutes: number,
  staff: StaffMember[],
  bookings: Booking[],
  excludeBookingId?: string
): StaffMember | null {
  if (requestedBarberId !== 'any') {
    const chosen = staff.find((s) => s.id === requestedBarberId);
    if (!chosen) return null;
    const busy = isSlotBookedForBarber(
      chosen.id,
      date,
      slotTime,
      durationMinutes,
      bookings,
      excludeBookingId
    );
    return busy ? null : chosen;
  }

  for (const member of staff) {
    const busy = isSlotBookedForBarber(
      member.id,
      date,
      slotTime,
      durationMinutes,
      bookings,
      excludeBookingId
    );
    if (!busy) return member;
  }
  return null;
}

export interface TimeSlotOption {
  time: string;
  available: boolean;
}

/**
 * Generates all time slots for a given date, marking each as available or disabled.
 */
export function generateTimeSlots(
  date: string,
  durationMinutes: number,
  requestedBarberId: string,
  openingHours: OpeningHours,
  closedDays: number[],
  blockedDates: string[],
  staff: StaffMember[],
  bookings: Booking[],
  excludeBookingId?: string
): TimeSlotOption[] {
  if (isDateClosed(date, closedDays, blockedDates) || staff.length === 0) {
    return [];
  }

  const startMin = timeToMinutes(openingHours.start);
  const endMin = timeToMinutes(openingHours.end);
  const interval = openingHours.slotIntervalMinutes || 30;
  const slots: TimeSlotOption[] = [];

  for (let t = startMin; t + durationMinutes <= endMin; t += interval) {
    const timeStr = minutesToTime(t);
    const availableBarber = findAvailableBarber(
      requestedBarberId,
      date,
      timeStr,
      durationMinutes,
      staff,
      bookings,
      excludeBookingId
    );
    slots.push({
      time: timeStr,
      available: availableBarber !== null,
    });
  }

  return slots;
}

/**
 * Generates a short human-readable booking code (e.g. CB-4829).
 */
export function generateBookingCode(prefix = 'CB'): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

/**
 * Builds the 3 automated reminder messages (24h before, 2h before, thank-you after)
 * for a confirmed booking.
 */
export function buildReminderLogs(
  booking: Booking,
  businessName: string,
  channel: 'WhatsApp' | 'SMS',
  templates?: { before24h: string; before2h: string; thankYou: string }
): ReminderLog[] {
  const [y, m, d] = booking.date.split('-').map(Number);
  const [hh, mm] = booking.time.split(':').map(Number);
  const apptDate = new Date(y, m - 1, d, hh, mm);

  const r24 = new Date(apptDate.getTime() - 24 * 60 * 60 * 1000);
  const r2 = new Date(apptDate.getTime() - 2 * 60 * 60 * 1000);
  const rAfter = new Date(apptDate.getTime() + (booking.durationMinutes + 30) * 60 * 1000);

  const fill = (tpl: string) =>
    tpl
      .replace(/\{name\}/g, booking.customerName)
      .replace(/\{service\}/g, booking.serviceName)
      .replace(/\{barber\}/g, booking.barberName)
      .replace(/\{time\}/g, booking.time)
      .replace(/\{shop\}/g, businessName);

  const tpl24 =
    templates?.before24h ||
    `Hi {name}, reminder from {shop}: your {service} with {barber} is tomorrow at {time}.`;
  const tpl2 =
    templates?.before2h ||
    `Hi {name}, your {service} at {shop} starts in 2 hours ({time}) with {barber}. See you soon!`;
  const tplThanks =
    templates?.thankYou ||
    `Thanks for visiting {shop}, {name}! Hope you love your fresh cut. Book anytime!`;

  return [
    {
      id: `${booking.id}-24h`,
      bookingId: booking.id,
      bookingCode: booking.code,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      type: '24h_before',
      channel,
      message: fill(tpl24),
      scheduledFor: r24.toISOString(),
      sent: false,
    },
    {
      id: `${booking.id}-2h`,
      bookingId: booking.id,
      bookingCode: booking.code,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      type: '2h_before',
      channel,
      message: fill(tpl2),
      scheduledFor: r2.toISOString(),
      sent: false,
    },
    {
      id: `${booking.id}-thankyou`,
      bookingId: booking.id,
      bookingCode: booking.code,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      type: 'thank_you',
      channel,
      message: fill(tplThanks),
      scheduledFor: rAfter.toISOString(),
      sent: false,
    },
  ];
}
