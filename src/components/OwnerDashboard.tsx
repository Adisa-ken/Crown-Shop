import { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CalendarX,
  CheckCircle2,
  Clock,
  DollarSign,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { BRAND } from '../brand';
import type {
  Booking,
  BookingStatus,
  ChatMessage,
  ReminderLog,
  Service,
  ShopSettings,
  StaffMember,
} from '../types';
import { BookingChat } from './BookingChat';
import { generateBookingCode } from '../utils/booking';

interface OwnerDashboardProps {
  bookings: Booking[];
  settings: ShopSettings;
  reminders: ReminderLog[];
  chatMessages?: ChatMessage[];
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  onResolveRefund?: (bookingId: string, status: 'refunded' | 'rejected', adminNote?: string) => void;
  onSendMessage?: (msg: ChatMessage) => void;
  onCreateBooking?: (booking: Booking) => void;
  onUpdateSettings: (settings: ShopSettings) => void;
  onMarkReminderSent: (reminderId: string) => void;
}

type OwnerTab = 'bookings' | 'refunds' | 'services' | 'hours' | 'reminders';

export function OwnerDashboard({
  bookings,
  settings,
  reminders,
  chatMessages = [],
  onUpdateBookingStatus,
  onResolveRefund,
  onSendMessage,
  onCreateBooking,
  onUpdateSettings,
  onMarkReminderSent,
}: OwnerDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('wl_owner_authed') === 'true';
    } catch {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OwnerTab>('bookings');

  // Active in-app chat modal with a customer
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);

  // Walk-in modal
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInServiceId, setWalkInServiceId] = useState(settings.services[0]?.id || '');
  const [walkInBarberId, setWalkInBarberId] = useState(settings.staff[0]?.id || '');
  const [walkInTime, setWalkInTime] = useState('12:00');

  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');

  // New service form state
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcPrice, setNewSvcPrice] = useState('');
  const [newSvcDuration, setNewSvcDuration] = useState('30');

  // New staff form state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Barber');

  // Block date input
  const [blockDateInput, setBlockDateInput] = useState('');

  // Refund reject note prompt
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email?.toLowerCase() === BRAND.ownerEmail.toLowerCase()) {
        setIsAuthenticated(true);
        try {
          sessionStorage.setItem('wl_owner_authed', 'true');
        } catch {
          // ignore
        }
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const val = pinInput.trim();
    if (val === BRAND.ownerPin || val.toLowerCase() === BRAND.ownerEmail.toLowerCase()) {
      setIsAuthenticated(true);
      setAuthError(null);
      try {
        sessionStorage.setItem('wl_owner_authed', 'true');
      } catch {
        // ignore
      }
    } else {
      setAuthError('Invalid PIN or owner email.');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (result.user.email?.toLowerCase() === BRAND.ownerEmail.toLowerCase()) {
        setIsAuthenticated(true);
        sessionStorage.setItem('wl_owner_authed', 'true');
      } else {
        await signOut(auth);
        setAuthError(`Signed in as ${result.user.email}, which is not the owner email (${BRAND.ownerEmail}).`);
      }
    } catch {
      setAuthError('Google sign-in was cancelled or not enabled in Firebase Auth.');
    }
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem('wl_owner_authed');
      await signOut(auth);
    } catch {
      // ignore
    }
  };

  const dailyBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.date === filterDate && (statusFilter === 'all' || b.status === statusFilter))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [bookings, filterDate, statusFilter]
  );

  const barberDailyCounts = useMemo(() => {
    return settings.staff.map((member) => {
      const completed = bookings.filter(
        (b) => b.date === filterDate && b.barberId === member.id && b.status === 'completed'
      );
      return {
        id: member.id,
        name: member.name,
        cuts: completed.length,
        revenue: completed.reduce((sum, b) => sum + b.servicePrice, 0),
      };
    });
  }, [bookings, filterDate, settings.staff]);

  const refundRequests = useMemo(
    () => bookings.filter((b) => b.refundStatus === 'requested'),
    [bookings]
  );

  const allRefunds = useMemo(
    () => bookings.filter((b) => b.refundStatus && b.refundStatus !== 'none'),
    [bookings]
  );

  const stats = useMemo(() => {
    const noShows = bookings.filter((b) => b.status === 'no-show').length;
    const depositsKept = bookings
      .filter((b) => b.status !== 'cancelled' && b.refundStatus !== 'refunded')
      .reduce((sum, b) => sum + b.depositAmount, 0);
    return {
      total: bookings.length,
      noShows,
      depositsKept,
      pendingRefunds: refundRequests.length,
    };
  }, [bookings, refundRequests]);

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSvcName.trim() || !newSvcPrice) return;
    const svc: Service = {
      id: `svc-${Date.now()}`,
      name: newSvcName.trim(),
      description: 'Custom salon service',
      price: Number(newSvcPrice),
      durationMinutes: Number(newSvcDuration) || 30,
    };
    onUpdateSettings({ ...settings, services: [...settings.services, svc] });
    setNewSvcName('');
    setNewSvcPrice('');
  };

  const handleRemoveService = (id: string) => {
    onUpdateSettings({
      ...settings,
      services: settings.services.filter((s) => s.id !== id),
    });
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    const member: StaffMember = {
      id: `barber-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole.trim() || 'Barber',
      specialty: 'All cuts',
    };
    onUpdateSettings({ ...settings, staff: [...settings.staff, member] });
    setNewStaffName('');
  };

  const handleRemoveStaff = (id: string) => {
    onUpdateSettings({
      ...settings,
      staff: settings.staff.filter((s) => s.id !== id),
    });
  };

  const handleBlockDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDateInput || settings.blockedDates.includes(blockDateInput)) return;
    onUpdateSettings({
      ...settings,
      blockedDates: [...settings.blockedDates, blockDateInput].sort(),
    });
    setBlockDateInput('');
  };

  const handleUnblockDate = (dateStr: string) => {
    onUpdateSettings({
      ...settings,
      blockedDates: settings.blockedDates.filter((d) => d !== dateStr),
    });
  };

  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim()) return;

    const svc = settings.services.find((s) => s.id === walkInServiceId) || settings.services[0];
    const barber = settings.staff.find((s) => s.id === walkInBarberId) || settings.staff[0];

    const code = generateBookingCode('WK');
    const newBooking: Booking = {
      id: `bk-walkin-${Date.now()}`,
      code,
      serviceId: svc.id,
      serviceName: svc.name,
      servicePrice: svc.price,
      durationMinutes: svc.durationMinutes,
      barberId: barber.id,
      barberName: barber.name,
      date: filterDate,
      time: walkInTime,
      customerName: walkInName.trim(),
      customerPhone: walkInPhone.trim() || '+234 000 000 0000',
      depositAmount: 0,
      paystackRef: 'WALK-IN',
      status: 'confirmed',
      checkedInAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (onCreateBooking) {
      onCreateBooking(newBooking);
    }
    setShowWalkInModal(false);
    setWalkInName('');
    setWalkInPhone('');
  };

  const activeChatBooking = bookings.find((b) => b.id === chatBookingId) || null;

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 sm:py-20">
        <form
          onSubmit={handleLogin}
          className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm"
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
            style={{ background: settings.accentColor || BRAND.colors.accent }}
          >
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
              Owner Dashboard
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
              Enter your owner PIN or sign in with Google to manage bookings, staff, refunds, and live chat.
            </p>
          </div>

          {authError && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
              {authError}
            </p>
          )}

          <div>
            <label
              htmlFor="owner-pin"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Owner PIN (Default: 1234)
            </label>
            <input
              id="owner-pin"
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="1234"
              className="w-full min-h-[48px] px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-xl font-semibold text-sm text-white shadow-sm"
            style={{ background: settings.accentColor || BRAND.colors.accent }}
          >
            Unlock Dashboard
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full min-h-[48px] rounded-xl font-semibold text-sm border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Owner Dashboard
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {BRAND.businessName} · Live Management Hub
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Total Bookings</p>
          <p className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
            {stats.total}
          </p>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">No-Shows</p>
          <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {stats.noShows}
          </p>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Deposits Kept</p>
          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {BRAND.currencySymbol}
            {stats.depositsKept.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Pending Refunds</p>
          <p
            className={`font-display text-2xl font-bold tabular-nums mt-1 ${
              stats.pendingRefunds > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-400'
            }`}
          >
            {stats.pendingRefunds}
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex gap-1.5 p-1 bg-stone-200/70 dark:bg-stone-900 rounded-2xl overflow-x-auto no-scrollbar">
        {(
          [
            ['bookings', 'Daily Schedule'],
            ['refunds', `Refunds (${refundRequests.length})`],
            ['services', 'Services & Staff'],
            ['hours', 'Hours & Blocked Days'],
            ['reminders', 'Reminders'],
          ] as [OwnerTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === key
                ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: DAILY SCHEDULE */}
      {activeTab === 'bookings' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                Daily Schedule
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Manage appointment statuses, confirmed arrivals, and live customer chat.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Filter bookings by date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs sm:text-sm tabular-nums"
              />
              <button
                type="button"
                onClick={() => setShowWalkInModal(true)}
                className="min-h-[40px] px-3.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-xs"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                <Plus className="w-4 h-4" />
                Add Walk-In
              </button>
            </div>
          </div>

          {/* Barber Daily Cut Counter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {barberDailyCounts.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl px-4 py-3 flex items-center justify-between shadow-xs"
              >
                <span className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                  {b.name}
                </span>
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400 tabular-nums shrink-0">
                  {b.cuts} {b.cuts === 1 ? 'cut' : 'cuts'} · {BRAND.currencySymbol}
                  {b.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'All'],
                ['confirmed', 'Confirmed'],
                ['completed', 'Completed'],
                ['no-show', 'No-show'],
                ['cancelled', 'Cancelled'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === key
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs'
                    : 'bg-stone-200/70 dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {dailyBookings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              No appointments scheduled for {filterDate}.
            </div>
          ) : (
            <div className="space-y-3">
              {dailyBookings.map((b) => {
                const bookingMsgs = chatMessages.filter((m) => m.bookingId === b.id);
                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono font-bold text-stone-600 dark:text-stone-400 tabular-nums">
                          {b.time}
                        </span>
                        <span className="text-stone-300 dark:text-stone-700">·</span>
                        <span className="text-xs font-mono text-stone-500 uppercase">{b.code}</span>
                        <span className="text-stone-300 dark:text-stone-700">·</span>
                        <span className="text-xs font-bold uppercase">{b.status}</span>

                        {/* Customer Presence Checked In Badge */}
                        {b.checkedInAt && (
                          <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            Waiting in Shop
                          </span>
                        )}

                        {/* Refund Requested Badge */}
                        {b.refundStatus === 'requested' && (
                          <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-md">
                            Refund Requested
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                        {b.customerName} — {b.serviceName}
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        Barber: <strong>{b.barberName}</strong> · Phone: {b.customerPhone} · Deposit:{' '}
                        {BRAND.currencySymbol}
                        {b.depositAmount.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Chat Button */}
                      <button
                        type="button"
                        onClick={() => setChatBookingId(b.id)}
                        className="min-h-[40px] px-3 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:border-amber-500 flex items-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                        Chat {bookingMsgs.length > 0 && `(${bookingMsgs.length})`}
                      </button>

                      {/* Status Action Buttons */}
                      <button
                        type="button"
                        onClick={() => onUpdateBookingStatus(b.id, 'completed')}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          b.status === 'completed'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateBookingStatus(b.id, 'no-show')}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold transition-colors ${
                          b.status === 'no-show'
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        No-show
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateBookingStatus(b.id, 'cancelled')}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          b.status === 'cancelled'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancelled
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: REFUND REQUESTS */}
      {activeTab === 'refunds' && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Customer Deposit Refund Requests
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Review customer cancellation refund requests. Customers are informed that approved refunds are processed within 3 to 5 business days.
            </p>
          </div>

          {allRefunds.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              No refund requests submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {allRefunds.map((b) => (
                <div
                  key={b.id}
                  className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-3 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-stone-600 dark:text-stone-400">
                          {b.code}
                        </span>
                        {b.refundStatus === 'requested' && (
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Pending Review
                          </span>
                        )}
                        {b.refundStatus === 'refunded' && (
                          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                            Refund Completed
                          </span>
                        )}
                        {b.refundStatus === 'rejected' && (
                          <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md">
                            Declined
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                        {b.customerName} ({b.customerPhone})
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        {b.serviceName} with {b.barberName} on {b.date} at {b.time}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Refund Amount</p>
                      <p className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                        {BRAND.currencySymbol}
                        {b.depositAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Reason & Bank Payout Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 text-xs">
                    <div>
                      <p className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                        Customer Reason
                      </p>
                      <p className="text-stone-800 dark:text-stone-200 mt-0.5">
                        {b.refundReason || 'No reason specified'}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                        Bank Account Details
                      </p>
                      <p className="font-mono text-stone-800 dark:text-stone-200 mt-0.5">
                        {b.refundBankDetails || 'Paystack reversal'}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons for Pending Refunds */}
                  {b.refundStatus === 'requested' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onResolveRefund?.(b.id, 'refunded')}
                        className="min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve &amp; Mark Refunded
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeclineTargetId(b.id);
                          setDeclineReason('');
                        }}
                        className="min-h-[40px] px-4 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        Decline Request
                      </button>

                      <button
                        type="button"
                        onClick={() => setChatBookingId(b.id)}
                        className="min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-amber-500 flex items-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                        Chat with Customer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: SERVICES & STAFF */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Services */}
          <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Services
            </h2>
            <div className="space-y-2">
              {settings.services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {s.name}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      {BRAND.currencySymbol}
                      {s.price.toLocaleString()} · {s.durationMinutes} mins
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => handleRemoveService(s.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddService} className="pt-2 space-y-2.5 border-t border-stone-100 dark:border-stone-800">
              <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                Add Service
              </p>
              <input
                type="text"
                placeholder="Service name"
                value={newSvcName}
                onChange={(e) => setNewSvcName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Price"
                  value={newSvcPrice}
                  onChange={(e) => setNewSvcPrice(e.target.value)}
                  className="flex-1 min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
                <input
                  type="number"
                  placeholder="Mins"
                  value={newSvcDuration}
                  onChange={(e) => setNewSvcDuration(e.target.value)}
                  className="w-24 min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                <Plus className="w-4 h-4" /> Add Service
              </button>
            </form>
          </section>

          {/* Staff */}
          <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Staff / Barbers
            </h2>
            <div className="space-y-2">
              {settings.staff.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {m.name}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{m.role}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => handleRemoveStaff(m.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddStaff} className="pt-2 space-y-2.5 border-t border-stone-100 dark:border-stone-800">
              <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                Add Staff Member
              </p>
              <input
                type="text"
                placeholder="Barber name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
              />
              <input
                type="text"
                placeholder="Role (e.g. Master Barber)"
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
              />
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                <Plus className="w-4 h-4" /> Add Staff
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TAB 4: HOURS & BLOCKED DAYS */}
      {activeTab === 'hours' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Opening Hours &amp; Booking Rules
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Open</label>
                <input
                  type="time"
                  value={settings.openingHours.start}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      openingHours: { ...settings.openingHours, start: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Close</label>
                <input
                  type="time"
                  value={settings.openingHours.end}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      openingHours: { ...settings.openingHours, end: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Allow Pay on Arrival
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Let customers book without paying a deposit upfront
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settings.allowPayOnArrival)}
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      allowPayOnArrival: !settings.allowPayOnArrival,
                    })
                  }
                  className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                    settings.allowPayOnArrival
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {settings.allowPayOnArrival ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2">
                  App Theme Gradient Presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Amber Gold', 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'],
                    ['Emerald Mint', 'linear-gradient(135deg, #10b981 0%, #047857 100%)'],
                    ['Royal Indigo', 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)'],
                    ['Crimson Rose', 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)'],
                    ['Midnight Slate', 'linear-gradient(135deg, #475569 0%, #0f172a 100%)'],
                  ].map(([label, grad]) => (
                    <button
                      key={grad}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, accentColor: grad })}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 ${
                        (settings.accentColor || BRAND.colors.accent) === grad
                          ? 'ring-2 ring-offset-2 ring-stone-900 dark:ring-stone-100'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ background: grad }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Block Off Days
            </h2>
            <form onSubmit={handleBlockDate} className="flex gap-2">
              <input
                type="date"
                aria-label="Date to block"
                value={blockDateInput}
                onChange={(e) => setBlockDateInput(e.target.value)}
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-white"
                style={{ background: settings.accentColor || BRAND.colors.accent }}
              >
                Block Day
              </button>
            </form>

            <div className="space-y-2">
              {settings.blockedDates.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">No blocked dates.</p>
              ) : (
                settings.blockedDates.map((d) => (
                  <div
                    key={d}
                    className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800"
                  >
                    <span className="text-sm font-medium tabular-nums flex items-center gap-2">
                      <CalendarX className="w-4 h-4 text-red-500" />
                      {d}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnblockDate(d)}
                      className="text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 min-h-[44px] px-2"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: AUTOMATED REMINDERS */}
      {activeTab === 'reminders' && (
        <section className="space-y-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-3">
            <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Edit Automated Message Templates (Optional)
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Placeholders: {'{name}'}, {'{service}'}, {'{barber}'}, {'{time}'}, {'{shop}'}
            </p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">
                  24 Hours Before
                </label>
                <input
                  type="text"
                  value={
                    settings.reminderTemplates?.before24h ??
                    BRAND.reminders.templates.before24h
                  }
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      reminderTemplates: {
                        before24h: e.target.value,
                        before2h:
                          settings.reminderTemplates?.before2h ??
                          BRAND.reminders.templates.before2h,
                        thankYou:
                          settings.reminderTemplates?.thankYou ??
                          BRAND.reminders.templates.thankYou,
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">
                  2 Hours Before
                </label>
                <input
                  type="text"
                  value={
                    settings.reminderTemplates?.before2h ??
                    BRAND.reminders.templates.before2h
                  }
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      reminderTemplates: {
                        before24h:
                          settings.reminderTemplates?.before24h ??
                          BRAND.reminders.templates.before24h,
                        before2h: e.target.value,
                        thankYou:
                          settings.reminderTemplates?.thankYou ??
                          BRAND.reminders.templates.thankYou,
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">
                  Thank-You After Visit
                </label>
                <input
                  type="text"
                  value={
                    settings.reminderTemplates?.thankYou ??
                    BRAND.reminders.templates.thankYou
                  }
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      reminderTemplates: {
                        before24h:
                          settings.reminderTemplates?.before24h ??
                          BRAND.reminders.templates.before24h,
                        before2h:
                          settings.reminderTemplates?.before2h ??
                          BRAND.reminders.templates.before2h,
                        thankYou: e.target.value,
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>
            </div>
          </div>

          <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
            Automated {BRAND.reminders.channel} Reminders (24h, 2h &amp; Thank-You)
          </h2>
          {reminders.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1">
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  {r.channel} · {r.type.replace('_', ' ')} · {r.customerName} ({r.customerPhone})
                </p>
                <p className="text-sm text-stone-800 dark:text-stone-200">{r.message}</p>
              </div>
              <button
                type="button"
                disabled={r.sent}
                onClick={() => onMarkReminderSent(r.id)}
                className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 ${
                  r.sent
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'text-white'
                }`}
                style={!r.sent ? { background: settings.accentColor || BRAND.colors.accent } : undefined}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {r.sent ? 'Sent' : 'Send Now'}
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Walk-in Booking Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                Add Walk-In Customer
              </h3>
              <button
                type="button"
                onClick={() => setShowWalkInModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Service
                  </label>
                  <select
                    value={walkInServiceId}
                    onChange={(e) => setWalkInServiceId(e.target.value)}
                    className="w-full min-h-[44px] px-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs"
                  >
                    {settings.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({BRAND.currencySymbol}{s.price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Barber
                  </label>
                  <select
                    value={walkInBarberId}
                    onChange={(e) => setWalkInBarberId(e.target.value)}
                    className="w-full min-h-[44px] px-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs"
                  >
                    {settings.staff.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Time Slot ({filterDate})
                </label>
                <input
                  type="time"
                  value={walkInTime}
                  onChange={(e) => setWalkInTime(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] rounded-xl font-semibold text-xs text-white"
                  style={{ background: settings.accentColor || BRAND.colors.accent }}
                >
                  Save Walk-In Booking
                </button>
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barber <-> Customer Chat Modal */}
      {chatBookingId && activeChatBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>Chat with {activeChatBooking.customerName}</span>
                  <span className="text-xs font-mono text-stone-400">({activeChatBooking.code})</span>
                </h3>
                <p className="text-xs text-stone-500">
                  {activeChatBooking.serviceName} · Barber: {activeChatBooking.barberName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatBookingId(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                ✕
              </button>
            </div>

            <BookingChat
              bookingId={activeChatBooking.id}
              bookingCode={activeChatBooking.code}
              customerName={activeChatBooking.customerName}
              barberName={activeChatBooking.barberName}
              senderRole="barber"
              senderDisplayName={`${activeChatBooking.barberName} (Barber)`}
              messages={chatMessages}
              onSendMessage={(msg) => onSendMessage?.(msg)}
              accentColor={settings.accentColor}
            />
          </div>
        </div>
      )}

      {/* Decline Refund Modal */}
      {declineTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Decline Refund Request
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Provide an optional explanation to the customer (e.g. appointment completed, outside cancellation window).
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining refund..."
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs text-stone-900 dark:text-stone-100"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onResolveRefund?.(declineTargetId, 'rejected', declineReason.trim() || undefined);
                  setDeclineTargetId(null);
                }}
                className="flex-1 min-h-[44px] rounded-xl font-semibold text-xs bg-rose-600 text-white"
              >
                Confirm Decline
              </button>
              <button
                type="button"
                onClick={() => setDeclineTargetId(null)}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
