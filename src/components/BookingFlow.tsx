import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Scissors,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { BRAND } from '../brand';
import type { Booking, Service, ShopSettings } from '../types';
import {
  calculateDeposit,
  findAvailableBarber,
  generateBookingCode,
  generateTimeSlots,
  isDateClosed,
} from '../utils/booking';
import {
  getSavedCustomerPhone,
  rememberBookingId,
  saveCustomerPhone,
} from '../utils/storage';

interface BookingFlowProps {
  settings: ShopSettings;
  bookings: Booking[];
  onCreateBooking: (booking: Booking) => void;
  onOpenManage: (code: string) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function BookingFlow({
  settings,
  bookings,
  onCreateBooking,
  onOpenManage,
}: BookingFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('any');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  });
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState(() => getSavedCustomerPhone());
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'arrival'>('deposit');
  const [formError, setFormError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const upcomingDays = useMemo(() => {
    const days: { dateStr: string; dayName: string; dayNum: string; month: string; closed: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      days.push({
        dateStr,
        dayName: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: String(d.getDate()),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        closed: isDateClosed(dateStr, settings.closedDays, settings.blockedDates),
      });
    }
    return days;
  }, [settings.closedDays, settings.blockedDates]);

  const timeSlots = useMemo(() => {
    if (!selectedService) return [];
    return generateTimeSlots(
      selectedDate,
      selectedService.durationMinutes,
      selectedBarberId,
      settings.openingHours,
      settings.closedDays,
      settings.blockedDates,
      settings.staff,
      bookings
    );
  }, [selectedService, selectedDate, selectedBarberId, settings, bookings]);

  const depositAmount = selectedService
    ? calculateDeposit(selectedService.price, settings.depositPercentage)
    : 0;

  const handlePaystackCheckout = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!customerName.trim() || customerName.trim().length < 2) {
      setFormError('Please enter your full name.');
      setStep(4);
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 7) {
      setFormError('Please enter a valid phone number for reminders.');
      setStep(4);
      return;
    }
    if (!selectedService || !selectedTime) {
      setFormError('Please select a service and time slot.');
      setStep(1);
      return;
    }

    // Re-check availability right before payment to prevent double bookings
    const assignedBarber = findAvailableBarber(
      selectedBarberId,
      selectedDate,
      selectedTime,
      selectedService.durationMinutes,
      settings.staff,
      bookings
    );

    if (!assignedBarber) {
      setFormError('Sorry, that slot was just booked. Please pick another time.');
      setStep(3);
      return;
    }

    setIsPaying(true);

    const completeBooking = (paystackRef: string) => {
      const code = generateBookingCode(
        BRAND.businessName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'BK'
      );

      const newBooking: Booking = {
        id: `bk-${Date.now()}`,
        code,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        durationMinutes: selectedService.durationMinutes,
        barberId: assignedBarber.id,
        barberName: assignedBarber.name,
        date: selectedDate,
        time: selectedTime,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        depositAmount,
        paystackRef,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      onCreateBooking(newBooking);
      rememberBookingId(newBooking.id);
      saveCustomerPhone(newBooking.customerPhone);
      setConfirmedBooking(newBooking);
      setIsPaying(false);
      setStep(6);
    };

    const paystackWin = window as unknown as {
      PaystackPop?: {
        setup: (opts: Record<string, unknown>) => { openIframe: () => void };
      };
    };

    const hasRealKey =
      BRAND.paystackPublicKey &&
      !BRAND.paystackPublicKey.includes('replace_with_owner_paystack_key');

    if (hasRealKey && paystackWin.PaystackPop) {
      const handler = paystackWin.PaystackPop.setup({
        key: BRAND.paystackPublicKey,
        email: `${customerPhone.replace(/\D/g, '') || 'customer'}@guest.booking`,
        amount: depositAmount * 100, // Paystack expects kobo/pesewas
        currency: BRAND.currency,
        ref: `PSK-${Date.now()}`,
        callback: (response: { reference: string }) => {
          completeBooking(response.reference);
        },
        onClose: () => {
          setIsPaying(false);
        },
      });
      handler.openIframe();
      return;
    }

    // Fallback simulated checkout when placeholder key is used
    setTimeout(() => {
      completeBooking(`PSK-${Date.now().toString().slice(-6)}`);
    }, 650);
  };

  const handlePayOnArrivalCheckout = () => {
    setFormError(null);
    if (!customerName.trim() || customerName.trim().length < 2) {
      setFormError('Please enter your full name.');
      setStep(4);
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 7) {
      setFormError('Please enter a valid phone number for reminders.');
      setStep(4);
      return;
    }
    if (!selectedService || !selectedTime) {
      setFormError('Please select a service and time slot.');
      setStep(1);
      return;
    }

    const assignedBarber = findAvailableBarber(
      selectedBarberId,
      selectedDate,
      selectedTime,
      selectedService.durationMinutes,
      settings.staff,
      bookings
    );

    if (!assignedBarber) {
      setFormError('Sorry, that slot was just booked. Please pick another time.');
      setStep(3);
      return;
    }

    const code = generateBookingCode(
      BRAND.businessName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'BK'
    );

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      code,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      servicePrice: selectedService.price,
      durationMinutes: selectedService.durationMinutes,
      barberId: assignedBarber.id,
      barberName: assignedBarber.name,
      date: selectedDate,
      time: selectedTime,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      depositAmount: 0,
      paystackRef: 'PAY-ON-ARRIVAL',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    onCreateBooking(newBooking);
    rememberBookingId(newBooking.id);
    saveCustomerPhone(newBooking.customerPhone);
    setConfirmedBooking(newBooking);
    setStep(6);
  };

  const resetFlow = () => {
    setStep(1);
    setSelectedService(null);
    setSelectedBarberId('any');
    setSelectedTime('');
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('deposit');
    setConfirmedBooking(null);
    setFormError(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Hero Intro on Step 1 with Luxury Ambient Gradient */}
      {step === 1 && (
        <div className="mb-8 p-6 sm:p-8 rounded-3xl hero-gradient border border-amber-500/20 dark:border-amber-500/10 relative overflow-hidden transition-all shadow-sm">
          <div
            className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full pointer-events-none opacity-20 dark:opacity-10 blur-2xl"
            style={{ background: settings.accentColor || BRAND.colors.accent }}
          />
          <div className="relative z-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 text-balance">
              {BRAND.businessName}
            </h1>
            <p className="mt-2 text-base text-stone-700 dark:text-stone-300 font-medium">
              {BRAND.tagline}
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
              <span>{BRAND.address}</span>
              <span aria-hidden="true">·</span>
              <span>{BRAND.phone}</span>
            </p>
          </div>
        </div>
      )}

      {/* Progress Stepper (Steps 1-5) */}
      {step < 6 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">
            <span>Step {step} of 5</span>
            <span>
              {step === 1 && 'Choose Service'}
              {step === 2 && 'Choose Barber'}
              {step === 3 && 'Date & Time'}
              {step === 4 && 'Your Details'}
              {step === 5 && 'Review & Payment'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full bg-amber-600"
              style={{
                width: `${(step / 5) * 100}%`,
                background: settings.accentColor || BRAND.colors.accent,
              }}
            />
          </div>
        </div>
      )}

      {/* Back Button */}
      {step > 1 && step < 6 && (
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setStep((s) => (s - 1) as Step);
          }}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 min-h-[44px] px-2 -ml-2 rounded-lg cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}

      {/* STEP 1: CHOOSE SERVICE */}
      {step === 1 && (
        <section aria-label="Choose a service" className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100 mb-3">
            Select a Service
          </h2>
          {settings.services.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => {
                setSelectedService(svc);
                setStep(2);
              }}
              className="w-full text-left p-4 sm:p-5 rounded-2xl card-gradient border border-stone-200/80 dark:border-stone-800/80 hover:border-amber-500/80 dark:hover:border-amber-500/80 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center justify-between gap-4 min-h-[72px] cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-base text-stone-900 dark:text-stone-100 truncate">
                    {svc.name}
                  </span>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 line-clamp-2">
                  {svc.description}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-500 mt-1.5 tabular-nums">
                  {svc.durationMinutes} mins
                </p>
              </div>
              <div className="text-right shrink-0 tabular-nums">
                <span className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                  {BRAND.currencySymbol}
                  {svc.price.toLocaleString()}
                </span>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* STEP 2: CHOOSE BARBER */}
      {step === 2 && (
        <section aria-label="Choose a barber" className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100 mb-3">
            Choose Your Barber
          </h2>

          {/* Any Barber Option */}
          <button
            type="button"
            onClick={() => {
              setSelectedBarberId('any');
              setSelectedTime('');
              setStep(3);
            }}
            className="w-full text-left p-4 sm:p-5 rounded-2xl card-gradient border border-stone-200/80 dark:border-stone-800/80 hover:border-amber-500/80 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4 min-h-[72px] cursor-pointer"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 bg-amber-600 shadow-sm"
              style={{ background: settings.accentColor || BRAND.colors.accent }}
            >
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-base text-stone-900 dark:text-stone-100">
                Any Available Barber
              </p>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Fastest availability — we&apos;ll pair you with the first free barber
              </p>
            </div>
          </button>

          {settings.staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setSelectedBarberId(member.id);
                setSelectedTime('');
                setStep(3);
              }}
              className="w-full text-left p-4 sm:p-5 rounded-2xl card-gradient border border-stone-200/80 dark:border-stone-800/80 hover:border-amber-500/80 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4 min-h-[72px] cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900 flex items-center justify-center text-stone-700 dark:text-stone-300 font-display font-bold shrink-0 shadow-2xs">
                {member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-base text-stone-900 dark:text-stone-100">
                  {member.name}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {member.role} · {member.specialty}
                </p>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* STEP 3: CHOOSE DAY & TIME */}
      {step === 3 && (
        <section aria-label="Choose date and time" className="space-y-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100 mb-3">
              Select Date
            </h2>
            <div className="flex gap-2.5 overflow-x-auto pb-2">
              {upcomingDays.map((d) => (
                <button
                  key={d.dateStr}
                  type="button"
                  disabled={d.closed}
                  onClick={() => {
                    setSelectedDate(d.dateStr);
                    setSelectedTime('');
                  }}
                  className={`min-w-[72px] min-h-[68px] px-3 py-2 rounded-2xl border flex flex-col items-center justify-center shrink-0 transition-all ${
                    d.closed
                      ? 'opacity-40 cursor-not-allowed bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-400'
                      : selectedDate === d.dateStr
                      ? 'text-white border-transparent shadow-md bg-amber-600'
                      : 'card-gradient border-stone-200/80 dark:border-stone-800/80 text-stone-900 dark:text-stone-100 hover:border-amber-500/70 hover:shadow-xs cursor-pointer'
                  }`}
                  style={
                    selectedDate === d.dateStr && !d.closed
                      ? { background: settings.accentColor || BRAND.colors.accent }
                      : undefined
                  }
                >
                  <span className="text-[11px] font-medium">{d.dayName}</span>
                  <span className="font-display text-lg font-bold tabular-nums leading-tight">
                    {d.dayNum}
                  </span>
                  <span className="text-[10px] opacity-80">{d.closed ? 'Closed' : d.month}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100 mb-3">
              Select Time
            </h2>
            {timeSlots.length === 0 ? (
              <div className="p-6 rounded-2xl card-gradient border border-stone-200/80 dark:border-stone-800/80 text-center text-sm text-stone-500 dark:text-stone-400 shadow-xs">
                No available slots on this date. Please choose another day.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => {
                      setSelectedTime(slot.time);
                      setStep(4);
                    }}
                    className={`min-h-[48px] rounded-xl text-sm font-semibold tabular-nums border transition-all ${
                      !slot.available
                        ? 'opacity-40 cursor-not-allowed bg-stone-100 dark:bg-stone-900 text-stone-400 border-stone-200 dark:border-stone-800 line-through'
                        : selectedTime === slot.time
                        ? 'text-white border-transparent shadow-md bg-amber-600'
                        : 'card-gradient text-stone-900 dark:text-stone-100 border-stone-200/80 dark:border-stone-800/80 hover:border-amber-500/70 hover:shadow-xs cursor-pointer'
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
        </section>
      )}

      {/* STEP 4: CONTACT INFORMATION (NO PAYMENT CTA BUTTON HERE) */}
      {step === 4 && selectedService && (
        <section aria-label="Enter contact details" className="space-y-6">
          {/* Quick Appointment Recap Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-amber-600 shadow-xs"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  {selectedService.name}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {selectedBarberId === 'any'
                    ? 'Any Available Barber'
                    : settings.staff.find((s) => s.id === selectedBarberId)?.name}{' '}
                  · {selectedService.durationMinutes} mins
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100 dark:border-stone-800">
              <p className="text-xs font-semibold uppercase text-stone-400">Selected Slot</p>
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                {selectedDate} at {selectedTime}
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              if (!customerName.trim() || customerName.trim().length < 2) {
                setFormError('Please enter your full name.');
                return;
              }
              if (!customerPhone.trim() || customerPhone.trim().length < 7) {
                setFormError('Please enter a valid phone number for appointment reminders.');
                return;
              }
              saveCustomerPhone(customerPhone.trim());
              setStep(5);
            }}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-7 space-y-5"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                Your Contact Details
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
                We use this information to send appointment reminders and link this booking to your device.
              </p>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="customer-name"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="customer-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Tobi Adeyemi"
                    className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="customer-phone"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5"
                >
                  Phone Number ({BRAND.reminders.channel} reminders)
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. +234 803 123 4567"
                  className="w-full min-h-[48px] px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">
                  We&apos;ll send booking confirmation and 24h/2h reminders to this number.
                </p>
              </div>
            </div>

            {/* Prominent, highly-visible navigation button to proceed to the Review & Payment step */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full min-h-[52px] rounded-xl font-bold text-base text-white bg-amber-600 flex items-center justify-center gap-2 transition-all hover:opacity-95 shadow-md active:scale-[0.99] cursor-pointer"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                <span>Continue to Review &amp; Payment</span>
                <ChevronRight className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* STEP 5: REVIEW & PAYMENT (DEDICATED STEP FOR PAYMENT & CHECKOUT CTA) */}
      {step === 5 && selectedService && (
        <section aria-label="Review booking and choose payment method" className="space-y-6">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          {/* 1. Complete Booking Summary */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                Booking Summary
              </h2>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-xs font-semibold text-amber-600 hover:underline"
              >
                Edit Contact Details
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Service</span>
                <span className="font-medium text-stone-900 dark:text-stone-100">
                  {selectedService.name} ({selectedService.durationMinutes} mins)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Barber</span>
                <span className="font-medium text-stone-900 dark:text-stone-100">
                  {selectedBarberId === 'any'
                    ? 'Any Available Barber'
                    : settings.staff.find((s) => s.id === selectedBarberId)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Date &amp; Time</span>
                <span className="font-medium text-stone-900 dark:text-stone-100 tabular-nums">
                  {selectedDate} at {selectedTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Customer</span>
                <span className="font-medium text-stone-900 dark:text-stone-100">
                  {customerName} ({customerPhone})
                </span>
              </div>
            </div>
          </div>

          {/* 2. Payment Method Selector */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
              Select Payment Method
            </h2>

            <div className="space-y-3">
              {/* Option A: Paystack Deposit */}
              <button
                type="button"
                onClick={() => setPaymentMethod('deposit')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                  paymentMethod === 'deposit'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    paymentMethod === 'deposit'
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-stone-300 dark:border-stone-700'
                  }`}
                >
                  {paymentMethod === 'deposit' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm sm:text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-600" />
                      Pay {settings.depositPercentage}% Deposit Now
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                      Instant Confirmation
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                    Pay {BRAND.currencySymbol}{depositAmount.toLocaleString()} via Paystack (Cards, Bank Transfer, USSD). Remaining {BRAND.currencySymbol}{(selectedService.price - depositAmount).toLocaleString()} is paid in the shop.
                  </p>
                </div>
              </button>

              {/* Option B: Pay on Arrival (if allowed in shop settings) */}
              {(settings.allowPayOnArrival ?? BRAND.allowPayOnArrival) && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('arrival')}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                    paymentMethod === 'arrival'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      paymentMethod === 'arrival'
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'border-stone-300 dark:border-stone-700'
                    }`}
                  >
                    {paymentMethod === 'arrival' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm sm:text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-amber-600" />
                        Pay Full Amount on Arrival
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                        Pay in Shop
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                      No upfront payment needed today. Pay {BRAND.currencySymbol}{selectedService.price.toLocaleString()} via cash, card, or transfer when you arrive.
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* 3. Final Price Breakdown & Dedicated Checkout CTA Area */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="space-y-2 text-sm border-b border-stone-100 dark:border-stone-800 pb-4">
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">Total Service Price</span>
                <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                  {BRAND.currencySymbol}{selectedService.price.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">Due Today</span>
                <span className="font-bold text-amber-600 tabular-nums">
                  {paymentMethod === 'deposit'
                    ? `${BRAND.currencySymbol}${depositAmount.toLocaleString()}`
                    : `${BRAND.currencySymbol}0`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">Due at the Shop</span>
                <span className="font-medium text-stone-800 dark:text-stone-200 tabular-nums">
                  {paymentMethod === 'deposit'
                    ? `${BRAND.currencySymbol}${(selectedService.price - depositAmount).toLocaleString()}`
                    : `${BRAND.currencySymbol}${selectedService.price.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Single Prominent Checkout CTA Button */}
            {paymentMethod === 'deposit' ? (
              <button
                type="button"
                disabled={isPaying}
                onClick={handlePaystackCheckout}
                className="w-full min-h-[54px] rounded-xl font-bold text-base text-white bg-amber-600 flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-60 shadow-md active:scale-[0.99] cursor-pointer"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                <CreditCard className="w-5 h-5" />
                {isPaying
                  ? 'Verifying Paystack Deposit...'
                  : `Pay ${BRAND.currencySymbol}${depositAmount.toLocaleString()} Deposit via Paystack`}
              </button>
            ) : (
              <button
                type="button"
                disabled={isPaying}
                onClick={handlePayOnArrivalCheckout}
                className="w-full min-h-[54px] rounded-xl font-bold text-base text-white bg-emerald-600 flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-60 shadow-md active:scale-[0.99] cursor-pointer"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                Confirm Appointment &amp; Pay on Arrival
              </button>
            )}

            <p className="text-xs text-center text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Secured Checkout · 256-bit SSL · Automated {BRAND.reminders.channel} Reminders
            </p>
          </div>
        </section>
      )}

      {/* STEP 6: CONFIRMATION SCREEN */}
      {step === 6 && confirmedBooking && (
        <section
          aria-label="Booking confirmed"
          className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 text-center space-y-6"
        >
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Booking Confirmed
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 mt-1">
              You&apos;re all set, {confirmedBooking.customerName.split(' ')[0]}!
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
              Your booking code is{' '}
              <strong className="font-mono text-stone-900 dark:text-stone-100">
                {confirmedBooking.code}
              </strong>
              . We&apos;ll send {BRAND.reminders.channel} reminders 24 hours and 2 hours before your
              visit.
            </p>
          </div>

          <div className="bg-stone-50 dark:bg-stone-950 rounded-xl p-4 text-left space-y-2 text-sm border border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <Scissors className="w-4 h-4 text-amber-600" />
              <span>
                {confirmedBooking.serviceName} with {confirmedBooking.barberName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 tabular-nums">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>{confirmedBooking.date}</span>
              <Clock className="w-4 h-4 text-amber-600 ml-2" />
              <span>{confirmedBooking.time}</span>
            </div>
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <User className="w-4 h-4 text-amber-600" />
              <span>
                {confirmedBooking.customerName} ({confirmedBooking.customerPhone})
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onOpenManage(confirmedBooking.code)}
              className="flex-1 min-h-[48px] px-4 rounded-xl font-semibold text-sm border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              Manage / Reschedule / Cancel
            </button>
            <button
              type="button"
              onClick={resetFlow}
              className="flex-1 min-h-[48px] px-4 rounded-xl font-semibold text-sm text-white bg-amber-600 shadow-sm transition-all hover:opacity-95"
              style={{ background: settings.accentColor || BRAND.colors.accent }}
            >
              Book Another Cut
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
