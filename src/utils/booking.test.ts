import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDeposit,
  isDateClosed,
  isSlotBookedForBarber,
  findAvailableBarber,
  generateTimeSlots,
  buildReminderLogs,
} from './booking';
import type { Booking, StaffMember } from '../types';

const STAFF: StaffMember[] = [
  { id: 'b1', name: 'Tunde', role: 'Master Barber', specialty: 'Fades' },
  { id: 'b2', name: 'Chidi', role: 'Stylist', specialty: 'Beards' },
];

const EXISTING_BOOKINGS: Booking[] = [
  {
    id: 'bk-1',
    code: 'CB-1001',
    serviceId: 'svc-1',
    serviceName: 'Skin Fade',
    servicePrice: 8000,
    durationMinutes: 45,
    barberId: 'b1',
    barberName: 'Tunde',
    date: '2026-11-11',
    time: '10:00',
    customerName: 'Ade',
    customerPhone: '08012345678',
    depositAmount: 2400,
    paystackRef: 'PSK-123',
    status: 'confirmed',
    createdAt: '2026-11-10T10:00:00Z',
  },
];

test('calculateDeposit computes rounded percentage', () => {
  assert.equal(calculateDeposit(8000, 30), 2400);
  assert.equal(calculateDeposit(5500, 25), 1375);
  assert.equal(calculateDeposit(5000, 0), 0);
});

test('isDateClosed respects closedDays and blockedDates', () => {
  // 2026-11-15 is a Sunday (day 0)
  assert.equal(isDateClosed('2026-11-15', [0], []), true);
  // 2026-11-11 is a Wednesday (day 3), not closed unless blocked
  assert.equal(isDateClosed('2026-11-11', [0], []), false);
  assert.equal(isDateClosed('2026-11-11', [0], ['2026-11-11']), true);
});

test('isSlotBookedForBarber prevents double-booking overlapping slots', () => {
  // b1 is booked 10:00 - 10:45
  assert.equal(isSlotBookedForBarber('b1', '2026-11-11', '10:00', 30, EXISTING_BOOKINGS), true);
  assert.equal(isSlotBookedForBarber('b1', '2026-11-11', '10:30', 30, EXISTING_BOOKINGS), true);
  // 11:00 is free for b1
  assert.equal(isSlotBookedForBarber('b1', '2026-11-11', '11:00', 30, EXISTING_BOOKINGS), false);
  // 10:00 is free for b2
  assert.equal(isSlotBookedForBarber('b2', '2026-11-11', '10:00', 30, EXISTING_BOOKINGS), false);
});

test('findAvailableBarber assigns free barber for "any" option', () => {
  const assigned = findAvailableBarber('any', '2026-11-11', '10:00', 30, STAFF, EXISTING_BOOKINGS);
  assert.equal(assigned?.id, 'b2');
});

test('generateTimeSlots disables booked slots for specific barber', () => {
  const slots = generateTimeSlots(
    '2026-11-11',
    30,
    'b1',
    { start: '09:00', end: '12:00', slotIntervalMinutes: 30 },
    [0],
    [],
    STAFF,
    EXISTING_BOOKINGS
  );
  const slot1000 = slots.find((s) => s.time === '10:00');
  const slot1030 = slots.find((s) => s.time === '10:30');
  const slot1100 = slots.find((s) => s.time === '11:00');
  assert.equal(slot1000?.available, false);
  assert.equal(slot1030?.available, false);
  assert.equal(slot1100?.available, true);
});

test('buildReminderLogs creates 24h, 2h, and thank-you reminders', () => {
  const logs = buildReminderLogs(EXISTING_BOOKINGS[0], 'Crown & Blade', 'WhatsApp');
  assert.equal(logs.length, 3);
  assert.equal(logs[0].type, '24h_before');
  assert.equal(logs[1].type, '2h_before');
  assert.equal(logs[2].type, 'thank_you');
  assert.ok(logs[0].message.includes('Crown & Blade'));
});
