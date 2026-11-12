const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * 1. Verify Paystack Payment & Create Booking Atomically (Prevents Double-Bookings)
 * Set PAYSTACK_SECRET_KEY in Firebase Functions environment:
 *   firebase functions:secrets:set PAYSTACK_SECRET_KEY
 */
exports.verifyPaystackAndBook = onCall(
  { secrets: ['PAYSTACK_SECRET_KEY'] },
  async (request) => {
    const { reference, booking, reminders } = request.data || {};
    if (!reference || !booking || !booking.date || !booking.time || !booking.barberId) {
      throw new HttpsError('invalid-argument', 'Missing booking or payment reference.');
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new HttpsError('failed-precondition', 'PAYSTACK_SECRET_KEY is not configured.');
    }

    // Verify transaction with Paystack API
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );
    const verifyJson = await verifyRes.json();
    if (!verifyJson.status || verifyJson.data?.status !== 'success') {
      throw new HttpsError('permission-denied', 'Paystack payment verification failed.');
    }

    // Run Firestore transaction to guarantee no double booking for the same barber/slot
    await db.runTransaction(async (tx) => {
      const existingSnap = await tx.get(
        db
          .collection('bookings')
          .where('date', '==', booking.date)
          .where('barberId', '==', booking.barberId)
          .where('status', '==', 'confirmed')
      );

      const conflict = existingSnap.docs.some((doc) => {
        const b = doc.data();
        return b.time === booking.time;
      });

      if (conflict) {
        throw new HttpsError('already-exists', 'This time slot was just booked.');
      }

      tx.set(db.collection('bookings').doc(booking.id), booking);
      if (Array.isArray(reminders)) {
        for (const r of reminders) {
          tx.set(db.collection('reminders').doc(r.id), r);
        }
      }
    });

    return { ok: true, bookingId: booking.id };
  }
);

/**
 * 2. Scheduled Automated WhatsApp Reminders (Runs every 15 minutes)
 * Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Firebase Functions secrets.
 */
exports.sendScheduledReminders = onSchedule(
  {
    schedule: 'every 15 minutes',
    secrets: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
  },
  async () => {
    const nowIso = new Date().toISOString();
    const snap = await db
      .collection('reminders')
      .where('sent', '==', false)
      .where('scheduledFor', '<=', nowIso)
      .limit(50)
      .get();

    if (snap.empty) return;

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      console.warn('WhatsApp credentials not configured; skipping reminder dispatch.');
      return;
    }

    for (const docSnap of snap.docs) {
      const reminder = docSnap.data();
      const to = String(reminder.customerPhone || '').replace(/\D/g, '');
      if (!to) continue;

      try {
        const res = await fetch(
          `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: { body: reminder.message },
            }),
          }
        );

        if (res.ok) {
          await docSnap.ref.update({ sent: true, sentAt: new Date().toISOString() });
        }
      } catch (err) {
        console.error('Failed to send reminder', reminder.id, err);
      }
    }
  }
);
