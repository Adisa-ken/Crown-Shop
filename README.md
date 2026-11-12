# White-Label Barbershop & Salon Booking App

A mobile-first, white-label booking web app you can sell once to barbershops and salons. Each business owner gets their own branded copy with **no subscription system**.

## Create a New Branded Copy in 10 Minutes

1. **Duplicate the repository** for your new client.
2. **Edit `src/brand.js`** (the only file you need to change):
   - `businessName`, `tagline`, `address`, `phone`, `logoUrl`
   - `colors.primary` and `colors.accent`
   - `currency`, `currencySymbol`, and `depositPercentage`
   - `paystackPublicKey` (client's Paystack key)
   - `ownerPin` and `ownerEmail`
   - `closedDays`, `openingHours`, `services`, and `staff`
   - `reminders.channel` (`"WhatsApp"` or `"SMS"`)
3. **Update `<title>` in `index.html`** to match the client's `businessName`.
4. **Build & Deploy**:
   ```bash
   npm install
   npm run build
   ```
   Deploy the `dist/` folder to Firebase Hosting, Vercel, or Netlify.

## Connecting Production Firebase & Paystack

- **Firestore**: Replace `src/utils/storage.ts` calls with Firestore `collection(db, 'bookings')` and `doc(db, 'settings', 'shop')` queries.
- **Paystack Verification**: Add a Firebase Cloud Function (`verifyPaystackAndBook`) that verifies `reference` against `https://api.paystack.co/transaction/verify/:reference` using the owner's secret key, then runs a Firestore transaction to ensure no double-booking occurred before writing the booking.
- **Automated Reminders**: Use a scheduled Cloud Function (`every 15 minutes`) to query `reminders` where `sent == false` and `scheduledFor <= now`, then dispatch via Twilio (SMS/WhatsApp) or Meta WhatsApp Cloud API.
