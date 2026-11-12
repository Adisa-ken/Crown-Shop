import { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  MessageSquare,
  DollarSign,
  AlertCircle,
  ChevronRight,
  User,
  ShieldCheck,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { BRAND } from '../brand';
import type { Booking, ChatMessage, ShopSettings } from '../types';
import { generateTimeSlots } from '../utils/booking';
import {
  getSavedBookingIds,
  getSavedCustomerPhone,
  rememberBookingId,
  saveCustomerPhone,
} from '../utils/storage';
import { BookingChat } from './BookingChat';

interface ManageBookingProps {
  bookings: Booking[];
  settings: ShopSettings;
  chatMessages: ChatMessage[];
  initialCode?: string;
  onReschedule: (bookingId: string, newDate: string, newTime: string) => void;
  onCancel: (bookingId: string) => void;
  onCheckIn?: (bookingId: string) => void;
  onRequestRefund?: (bookingId: string, reason: string, bankDetails: string) => void;
  onSendMessage?: (msg: ChatMessage) => void;
  onBackToBook: () => void;
}

export function ManageBooking({
  bookings,
  settings,
  chatMessages,
  initialCode = '',
  onReschedule,
  onCancel,
  onCheckIn,
  onRequestRefund,
  onSendMessage,
  onBackToBook,
}: ManageBookingProps) {
  // Device memory: get saved booking IDs and phone
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedBookingIds());
  const [savedPhone, setSavedPhone] = useState<string>(() => getSavedCustomerPhone());

  // Search override for cross-device lookup
  const [searchQuery, setSearchQuery] = useState(initialCode);
  const [showManualLookup, setShowManualLookup] = useState(false);

  // Active selected booking ID
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Action states
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Chat toggle
  const [showChat, setShowChat] = useState(false);

  // Refund modal / form state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('Change of schedule / cannot attend');
  const [refundBankDetails, setRefundBankDetails] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

  // Find all auto-recognized customer bookings (by remembered IDs or remembered phone)
  const myBookings = useMemo(() => {
    const list = bookings.filter((b) => {
      if (savedIds.includes(b.id)) return true;
      if (savedPhone && b.customerPhone.replace(/\D/g, '') === savedPhone.replace(/\D/g, '')) return true;
      return false;
    });

    // If query typed, also match code or phone
    const clean = searchQuery.trim().toUpperCase();
    if (clean) {
      const match = bookings.filter(
        (b) =>
          b.code.toUpperCase() === clean ||
          b.id === searchQuery.trim() ||
          b.customerPhone.replace(/\D/g, '').includes(clean.replace(/\D/g, ''))
      );
      for (const m of match) {
        if (!list.some((item) => item.id === m.id)) {
          list.push(m);
        }
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, savedIds, savedPhone, searchQuery]);

  // Set default selected booking
  useEffect(() => {
    if (initialCode) {
      const found = bookings.find(
        (b) => b.code.toUpperCase() === initialCode.trim().toUpperCase() || b.id === initialCode
      );
      if (found) {
        setSelectedBookingId(found.id);
        rememberBookingId(found.id);
        return;
      }
    }

    if (!selectedBookingId && myBookings.length > 0) {
      setSelectedBookingId(myBookings[0].id);
    }
  }, [initialCode, bookings, myBookings, selectedBookingId]);

  const activeBooking = useMemo(() => {
    return bookings.find((b) => b.id === selectedBookingId) || myBookings[0] || null;
  }, [bookings, selectedBookingId, myBookings]);

  const upcomingDays = useMemo(() => {
    const days: { dateStr: string; label: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const label = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      days.push({ dateStr, label });
    }
    return days;
  }, []);

  const availableSlots = useMemo(() => {
    if (!activeBooking || !selectedDate) return [];
    return generateTimeSlots(
      selectedDate,
      activeBooking.durationMinutes,
      activeBooking.barberId,
      settings.openingHours,
      settings.closedDays,
      settings.blockedDates,
      settings.staff,
      bookings,
      activeBooking.id
    );
  }, [activeBooking, selectedDate, settings, bookings]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim().toUpperCase();
    if (!clean) return;

    const found = bookings.find(
      (b) =>
        b.code.toUpperCase() === clean ||
        b.id === searchQuery.trim() ||
        b.customerPhone.replace(/\D/g, '') === clean.replace(/\D/g, '')
    );

    if (found) {
      rememberBookingId(found.id);
      saveCustomerPhone(found.customerPhone);
      setSavedIds(getSavedBookingIds());
      setSavedPhone(found.customerPhone);
      setSelectedBookingId(found.id);
      setFeedback(`Found booking for ${found.customerName} (${found.code})`);
      setShowManualLookup(false);
    } else {
      setFeedback(`No appointment found for "${searchQuery.trim()}". Check the phone or code.`);
    }
  };

  const handleConfirmReschedule = () => {
    if (!activeBooking || !selectedDate || !selectedTime) return;
    onReschedule(activeBooking.id, selectedDate, selectedTime);
    setRescheduleMode(false);
    setFeedback(`Rescheduled to ${selectedDate} at ${selectedTime}!`);
  };

  const handleCancelBooking = () => {
    if (!activeBooking) return;
    onCancel(activeBooking.id);
    setRescheduleMode(false);
    setFeedback(`Booking ${activeBooking.code} has been cancelled.`);
  };

  const handleSubmitRefund = (e: React.FormEvent) => {
    e.preventDefault();
    setRefundError(null);
    if (!refundBankDetails.trim() || refundBankDetails.trim().length < 8) {
      setRefundError('Please enter your Bank Name, Account Number, and Account Name.');
      return;
    }

    if (!activeBooking) return;
    if (onRequestRefund) {
      onRequestRefund(activeBooking.id, refundReason, refundBankDetails.trim());
    }
    setShowRefundModal(false);
    setFeedback(
      `Refund requested for ${BRAND.currencySymbol}${activeBooking.depositAmount.toLocaleString()}. The shop will review and process your refund within 3–5 business days.`
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            My Appointments
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            View your bookings, check in on arrival, message your barber, or request refunds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowManualLookup((prev) => !prev)}
          className="self-start sm:self-auto min-h-[40px] px-3.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors flex items-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          {showManualLookup ? 'Hide Search' : 'Find via Phone/Code'}
        </button>
      </div>

      {/* Cross-device manual search drawer */}
      {showManualLookup && (
        <form
          onSubmit={handleManualSearch}
          className="mb-6 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3"
        >
          <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
            Looking for a booking made on a different device or phone?
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter your Phone Number or Booking Code (e.g. CB-2041)"
              className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm text-stone-900 dark:text-stone-100"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl text-white text-xs font-semibold shrink-0"
              style={{ background: settings.accentColor || BRAND.colors.accent }}
            >
              Lookup
            </button>
          </div>
        </form>
      )}

      {/* Global Toast Feedback */}
      {feedback && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{feedback}</p>
        </div>
      )}

      {/* Empty State: No appointments recognized on this device */}
      {myBookings.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-8 sm:p-12 text-center space-y-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mx-auto shadow-md"
            style={{ background: settings.accentColor || BRAND.colors.accent }}
          >
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              No Appointments Found On This Device
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 max-w-md mx-auto">
              When you book a haircut or grooming session, it automatically appears right here without needing any code.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={onBackToBook}
              className="min-h-[48px] px-6 rounded-xl font-semibold text-sm text-white shadow-sm"
              style={{ background: settings.accentColor || BRAND.colors.accent }}
            >
              Book an Appointment
            </button>
            <button
              type="button"
              onClick={() => setShowManualLookup(true)}
              className="min-h-[48px] px-5 rounded-xl font-semibold text-sm border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            >
              Look Up Existing Booking
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Multiple Bookings Switcher Pill Row */}
          {myBookings.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {myBookings.map((b) => {
                const isSelected = activeBooking?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBookingId(b.id);
                      setRescheduleMode(false);
                      setShowChat(false);
                      setFeedback(null);
                    }}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all ${
                      isSelected
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-amber-500'
                    }`}
                    style={
                      isSelected
                        ? { background: settings.accentColor || BRAND.colors.accent }
                        : undefined
                    }
                  >
                    <span>{b.serviceName}</span>
                    <span className="opacity-75 ml-1.5 tabular-nums">· {b.date}</span>
                  </button>
                );
              })}
            </div>
          )}

          {activeBooking && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
              {/* Card Top: Code, Status & Service Info */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-stone-100 dark:border-stone-800 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-md">
                      {activeBooking.code}
                    </span>

                    {/* Status Pill */}
                    {activeBooking.status === 'confirmed' && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirmed
                      </span>
                    )}
                    {activeBooking.status === 'completed' && (
                      <span className="text-xs font-bold text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-md">
                        Completed
                      </span>
                    )}
                    {activeBooking.status === 'no-show' && (
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-md">
                        No-Show
                      </span>
                    )}
                    {activeBooking.status === 'cancelled' && (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-md">
                        Cancelled
                      </span>
                    )}

                    {/* Refund Status Pill */}
                    {activeBooking.refundStatus === 'requested' && (
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Refund In Review
                      </span>
                    )}
                    {activeBooking.refundStatus === 'refunded' && (
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2.5 py-0.5 rounded-md">
                        Refunded
                      </span>
                    )}
                    {activeBooking.refundStatus === 'rejected' && (
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 px-2.5 py-0.5 rounded-md">
                        Refund Declined
                      </span>
                    )}
                  </div>

                  <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {activeBooking.serviceName}
                  </h2>
                  <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    Barber: <strong className="text-stone-800 dark:text-stone-200">{activeBooking.barberName}</strong>
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <p className="text-lg font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                    {BRAND.currencySymbol}
                    {activeBooking.servicePrice.toLocaleString()}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    Deposit: {BRAND.currencySymbol}
                    {activeBooking.depositAmount.toLocaleString()}{' '}
                    {activeBooking.depositAmount > 0 ? '(Paid)' : '(Pay in shop)'}
                  </p>
                </div>
              </div>

              {/* Date & Time Big Tile */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: settings.accentColor || BRAND.colors.accent }}
                  >
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Date</p>
                    <p className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                      {activeBooking.date}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: settings.accentColor || BRAND.colors.accent }}
                  >
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Time</p>
                    <p className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                      {activeBooking.time} ({activeBooking.durationMinutes}m)
                    </p>
                  </div>
                </div>
              </div>

              {/* Refund Status Alert Banner */}
              {activeBooking.refundStatus === 'requested' && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs sm:text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
                  <RefreshCw className="w-4 h-4 text-amber-600 mt-0.5 shrink-0 animate-spin" />
                  <div>
                    <p className="font-semibold">Refund Request Submitted</p>
                    <p className="text-xs opacity-90 mt-0.5">
                      Your refund for {BRAND.currencySymbol}
                      {activeBooking.depositAmount.toLocaleString()} is currently under review by {BRAND.businessName}. Approved refunds are credited to your bank account within 3–5 business days.
                    </p>
                    {activeBooking.refundReason && (
                      <p className="text-xs mt-1 font-mono text-stone-600 dark:text-stone-400">
                        Reason: {activeBooking.refundReason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeBooking.refundStatus === 'refunded' && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Refund Completed</p>
                    <p className="text-xs opacity-90 mt-0.5">
                      Your deposit of {BRAND.currencySymbol}
                      {activeBooking.depositAmount.toLocaleString()} has been refunded.
                    </p>
                  </div>
                </div>
              )}

              {activeBooking.refundStatus === 'rejected' && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-800 dark:text-rose-200 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Refund Request Declined</p>
                    <p className="text-xs opacity-90 mt-0.5">
                      {activeBooking.refundAdminNote || 'The shop was unable to process this refund under the deposit cancellation policy.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Presence Check-In Banner */}
              {activeBooking.status === 'confirmed' && (
                <div className="pt-1">
                  {activeBooking.checkedInAt ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Presence Confirmed! {activeBooking.barberName} has received notification that you are waiting.
                      </span>
                    </div>
                  ) : (
                    onCheckIn && (
                      <button
                        type="button"
                        onClick={() => {
                          onCheckIn(activeBooking.id);
                          setFeedback(`You're checked in! ${activeBooking.barberName} knows you're here.`);
                        }}
                        className="w-full min-h-[48px] px-4 rounded-2xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-2 shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm I&apos;m Here (Check-In Waiting Area)
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Core Action Hub: Chat, Reschedule, Cancel, Refund */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                {/* 1. Live Chat Toggle */}
                <button
                  type="button"
                  onClick={() => setShowChat((prev) => !prev)}
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors ${
                    showChat
                      ? 'bg-stone-900 text-white border-transparent dark:bg-stone-100 dark:text-stone-900'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:border-amber-500'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  {showChat ? 'Close Chat' : `Chat with ${activeBooking.barberName}`}
                </button>

                {/* 2. Reschedule Button */}
                {activeBooking.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleMode(true);
                      setSelectedDate(activeBooking.date);
                      setSelectedTime('');
                      setShowChat(false);
                    }}
                    className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:border-amber-500 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    Reschedule Time
                  </button>
                )}

                {/* 3. Refund / Cancel Request Button */}
                {activeBooking.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeBooking.depositAmount > 0) {
                        setShowRefundModal(true);
                      } else {
                        handleCancelBooking();
                      }
                    }}
                    className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {activeBooking.depositAmount > 0 ? (
                      <>
                        <DollarSign className="w-3.5 h-3.5 text-rose-500" />
                        Cancel / Request Refund
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        Cancel Booking
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Real-time In-App Chat Drawer */}
              {showChat && (
                <div className="pt-2 animate-in fade-in duration-200">
                  <BookingChat
                    bookingId={activeBooking.id}
                    bookingCode={activeBooking.code}
                    customerName={activeBooking.customerName}
                    barberName={activeBooking.barberName}
                    senderRole="customer"
                    senderDisplayName={activeBooking.customerName}
                    messages={chatMessages}
                    onSendMessage={(msg) => onSendMessage?.(msg)}
                    accentColor={settings.accentColor}
                  />
                </div>
              )}

              {/* Reschedule View */}
              {rescheduleMode && (
                <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                      Pick a New Appointment Date &amp; Time
                    </h3>
                    <button
                      type="button"
                      onClick={() => setRescheduleMode(false)}
                      className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-2">
                      Select Date
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {upcomingDays.map((d) => (
                        <button
                          key={d.dateStr}
                          type="button"
                          onClick={() => {
                            setSelectedDate(d.dateStr);
                            setSelectedTime('');
                          }}
                          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                            selectedDate === d.dateStr
                              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent shadow-xs'
                              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-2">
                      Select New Slot
                    </label>
                    {availableSlots.length === 0 ? (
                      <p className="text-xs text-stone-500">Shop is closed on this date.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`min-h-[40px] rounded-xl text-xs font-medium tabular-nums border transition-colors ${
                              !slot.available
                                ? 'opacity-40 cursor-not-allowed bg-stone-100 dark:bg-stone-800 text-stone-400 line-through'
                                : selectedTime === slot.time
                                ? 'text-white border-transparent'
                                : 'bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-800'
                            }`}
                            style={
                              selectedTime === slot.time
                                ? { background: settings.accentColor || BRAND.colors.accent }
                                : undefined
                            }
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!selectedTime}
                      onClick={handleConfirmReschedule}
                      className="flex-1 min-h-[44px] rounded-xl font-semibold text-xs text-white disabled:opacity-40"
                      style={{ background: settings.accentColor || BRAND.colors.accent }}
                    >
                      Save New Appointment Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setRescheduleMode(false)}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Refund Request Modal */}
      {showRefundModal && activeBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                  Request Deposit Refund
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Deposit amount:{' '}
                  <strong className="text-stone-900 dark:text-stone-100 tabular-nums">
                    {BRAND.currencySymbol}
                    {activeBooking.depositAmount.toLocaleString()}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400 space-y-1">
              <p className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                3 to 5 Business Days Refund Policy
              </p>
              <p>
                Deposit refund requests are reviewed and sent via bank transfer or Paystack reversal within 3 to 5 business days.
              </p>
            </div>

            {refundError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                {refundError}
              </p>
            )}

            <form onSubmit={handleSubmitRefund} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Reason for Cancellation / Refund
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs sm:text-sm text-stone-900 dark:text-stone-100"
                >
                  <option value="Change of schedule / cannot attend">Change of schedule / cannot attend</option>
                  <option value="Emergency or ill">Emergency or unwell</option>
                  <option value="Rescheduled elsewhere">Rescheduled elsewhere</option>
                  <option value="Barber requested cancellation">Barber requested cancellation</option>
                  <option value="Other reason">Other reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Bank Payout Details (for transfer refund)
                </label>
                <textarea
                  rows={3}
                  value={refundBankDetails}
                  onChange={(e) => setRefundBankDetails(e.target.value)}
                  placeholder="e.g. GTBank / 0123456789 / Damilola Peters"
                  className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs sm:text-sm text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] rounded-xl font-semibold text-xs text-white"
                  style={{ background: settings.accentColor || BRAND.colors.accent }}
                >
                  Submit Refund Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
