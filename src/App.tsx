import { useEffect, useState } from 'react';
import { BRAND } from './brand';
import { Header, type AppView } from './components/Header';
import { BookingFlow } from './components/BookingFlow';
import { ManageBooking } from './components/ManageBooking';
import { OwnerDashboard } from './components/OwnerDashboard';
import type { Booking, BookingStatus, ChatMessage, ReminderLog, ShopSettings } from './types';
import { buildReminderLogs } from './utils/booking';
import {
  checkInBookingInFirestore,
  createBookingInFirestore,
  loadAllChatMessages,
  loadBookings,
  loadReminders,
  loadSettings,
  markReminderSentInFirestore,
  requestRefundInFirestore,
  rescheduleBookingInFirestore,
  resolveRefundInFirestore,
  saveAllChatMessages,
  saveBookings,
  saveReminders,
  saveSettings,
  saveSettingsInFirestore,
  sendChatMessageInFirestore,
  subscribeToAllChatMessages,
  subscribeToBookings,
  subscribeToSettings,
  updateBookingStatusInFirestore,
} from './utils/storage';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'manage' || hash === 'owner') return hash;
    return 'book';
  });
  const [manageCode, setManageCode] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wl_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [bookings, setBookings] = useState<Booking[]>(() => loadBookings());
  const [settings, setSettings] = useState<ShopSettings>(() => loadSettings());
  const [reminders, setReminders] = useState<ReminderLog[]>(() => loadReminders());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadAllChatMessages());

  useEffect(() => {
    const unsubBookings = subscribeToBookings(setBookings);
    const unsubSettings = subscribeToSettings(setSettings);
    const unsubChats = subscribeToAllChatMessages(setChatMessages);
    return () => {
      unsubBookings();
      unsubSettings();
      unsubChats();
    };
  }, []);

  useEffect(() => {
    const accent = settings.accentColor || BRAND.colors.accent;
    document.documentElement.style.setProperty('--brand-accent', accent);
  }, [settings.accentColor]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('wl_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  // Support deep-linking to ?code=CB-XXXX for reschedule/cancel links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setManageCode(code);
      setActiveView('manage');
      window.location.hash = 'manage';
    }
  }, []);

  const handleCreateBooking = (newBooking: Booking) => {
    const updatedBookings = [newBooking, ...bookings];
    setBookings(updatedBookings);
    saveBookings(updatedBookings);

    const newLogs = buildReminderLogs(
      newBooking,
      BRAND.businessName,
      BRAND.reminders.channel as 'WhatsApp' | 'SMS',
      settings.reminderTemplates
    );
    const updatedReminders = [...newLogs, ...reminders];
    setReminders(updatedReminders);
    saveReminders(updatedReminders);

    void createBookingInFirestore(newBooking, newLogs);
  };

  const handleUpdateBookingStatus = (bookingId: string, status: BookingStatus) => {
    const updated = bookings.map((b) => (b.id === bookingId ? { ...b, status } : b));
    setBookings(updated);
    saveBookings(updated);
    void updateBookingStatusInFirestore(bookingId, status);
  };

  const handleReschedule = (bookingId: string, newDate: string, newTime: string) => {
    const updated = bookings.map((b) =>
      b.id === bookingId ? { ...b, date: newDate, time: newTime } : b
    );
    setBookings(updated);
    saveBookings(updated);
    void rescheduleBookingInFirestore(bookingId, newDate, newTime);
  };

  const handleCancel = (bookingId: string) => {
    handleUpdateBookingStatus(bookingId, 'cancelled');
  };

  const handleCheckIn = (bookingId: string) => {
    const timestamp = new Date().toISOString();
    const updated = bookings.map((b) =>
      b.id === bookingId ? { ...b, checkedInAt: timestamp } : b
    );
    setBookings(updated);
    saveBookings(updated);
    void checkInBookingInFirestore(bookingId, timestamp);
  };

  const handleRequestRefund = (bookingId: string, reason: string, bankDetails: string) => {
    const requestedAt = new Date().toISOString();
    const updated = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            refundStatus: 'requested' as const,
            refundReason: reason,
            refundBankDetails: bankDetails,
            refundRequestedAt: requestedAt,
          }
        : b
    );
    setBookings(updated);
    saveBookings(updated);
    void requestRefundInFirestore(bookingId, reason, bankDetails);
  };

  const handleResolveRefund = (
    bookingId: string,
    status: 'refunded' | 'rejected',
    adminNote?: string
  ) => {
    const resolvedAt = new Date().toISOString();
    const updated = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            refundStatus: status,
            refundResolvedAt: resolvedAt,
            ...(adminNote ? { refundAdminNote: adminNote } : {}),
            ...(status === 'refunded' ? { status: 'cancelled' as BookingStatus } : {}),
          }
        : b
    );
    setBookings(updated);
    saveBookings(updated);
    void resolveRefundInFirestore(bookingId, status, adminNote);
  };

  const handleSendMessage = (msg: ChatMessage) => {
    const updated = [...chatMessages, msg];
    setChatMessages(updated);
    saveAllChatMessages(updated);
    void sendChatMessageInFirestore(msg);
  };

  const handleUpdateSettings = (nextSettings: ShopSettings) => {
    setSettings(nextSettings);
    saveSettings(nextSettings);
    void saveSettingsInFirestore(nextSettings);
  };

  const handleMarkReminderSent = (reminderId: string) => {
    const updated = reminders.map((r) => (r.id === reminderId ? { ...r, sent: true } : r));
    setReminders(updated);
    saveReminders(updated);
    void markReminderSentInFirestore(reminderId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
      <Header
        activeView={activeView}
        onNavigate={(view) => {
          setActiveView(view);
          window.location.hash = view;
        }}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
      />

      <main className="flex-1">
        {activeView === 'book' && (
          <BookingFlow
            settings={settings}
            bookings={bookings}
            onCreateBooking={handleCreateBooking}
            onOpenManage={(code) => {
              setManageCode(code);
              setActiveView('manage');
              window.location.hash = 'manage';
            }}
          />
        )}

        {activeView === 'manage' && (
          <ManageBooking
            bookings={bookings}
            settings={settings}
            chatMessages={chatMessages}
            initialCode={manageCode}
            onReschedule={handleReschedule}
            onCancel={handleCancel}
            onCheckIn={handleCheckIn}
            onRequestRefund={handleRequestRefund}
            onSendMessage={handleSendMessage}
            onBackToBook={() => {
              setActiveView('book');
              window.location.hash = 'book';
            }}
          />
        )}

        {activeView === 'owner' && (
          <OwnerDashboard
            bookings={bookings}
            settings={settings}
            reminders={reminders}
            chatMessages={chatMessages}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onResolveRefund={handleResolveRefund}
            onSendMessage={handleSendMessage}
            onCreateBooking={handleCreateBooking}
            onUpdateSettings={handleUpdateSettings}
            onMarkReminderSent={handleMarkReminderSent}
          />
        )}
      </main>

      <footer className="border-t border-stone-200 dark:border-stone-800 py-6 px-4 text-center text-xs text-stone-500 dark:text-stone-500 flex items-center justify-center gap-3">
        <span>
          {BRAND.businessName} · {BRAND.address}
        </span>
        <button
          type="button"
          onClick={() => {
            setActiveView('owner');
            window.location.hash = 'owner';
          }}
          className="underline hover:text-stone-800 dark:hover:text-stone-300"
        >
          Owner Login
        </button>
      </footer>
    </div>
  );
}
