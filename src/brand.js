/**
 * ============================================================================
 * WHITE-LABEL BRAND CONFIGURATION (brand.js)
 * ============================================================================
 * Change ONLY this file to rebrand the entire application for a new barbershop
 * or salon client. No other code changes required.
 */

export const BRAND = {
  // 1. Business Identity
  businessName: "Crown & Blade",
  tagline: "Precision cuts, hot towel shaves, and modern grooming.",
  address: "42 Admiralty Way, Lekki Phase 1, Lagos",
  phone: "+234 800 555 0199",
  // Optional logo image URL. Leave empty "" to use the built-in monogram mark.
  logoUrl: "",

  // 2. Brand Colors (Gradients and hex codes used for primary buttons, active states, accents)
  colors: {
    primary: "#18181b", // Deep charcoal for primary actions
    accent: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)", // Warm luxury amber/gold gradient
    accentSolid: "#d97706",
  },

  // 3. Currency & Deposit Rules
  currency: "NGN",
  currencySymbol: "₦",
  // Percentage of service price required as an upfront booking deposit (0 - 100)
  depositPercentage: 30,
  // Set true to let customers optionally pay in-shop on arrival
  allowPayOnArrival: false,

  // 4. Paystack Payment Configuration
  // Replace with the business owner's live Paystack public key
  paystackPublicKey: "pk_test_25f8213e70fb60d85a7088b42c7782b1c63ba37f",

  // 5. Owner Dashboard Access
  ownerPin: "1234",
  ownerEmail: "kadisa2030@gmail.com",

  // 6. Opening Hours & Closed Days
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  closedDays: [0], // Closed on Sundays
  openingHours: {
    start: "09:00", // 24-hour format HH:MM
    end: "20:00",   // 24-hour format HH:MM
    slotIntervalMinutes: 30,
  },

  // 7. Services Menu
  services: [
    {
      id: "svc-fade",
      name: "Signature Skin Fade",
      description: "Precision taper fade, razor line-up, and styling finish.",
      price: 8000,
      durationMinutes: 45,
    },
    {
      id: "svc-cut-beard",
      name: "Haircut & Beard Sculpt",
      description: "Full haircut, beard trim, hot towel, and conditioning oil.",
      price: 12000,
      durationMinutes: 60,
    },
    {
      id: "svc-beard",
      name: "Beard Trim & Hot Towel",
      description: "Crisp beard shaping with steam towel and straight-razor edge.",
      price: 5000,
      durationMinutes: 30,
    },
    {
      id: "svc-kids",
      name: "Junior Cut (Under 12)",
      description: "Clean, patient styling for young gentlemen.",
      price: 5500,
      durationMinutes: 30,
    },
    {
      id: "svc-vip",
      name: "The Royal Grooming",
      description: "Haircut, beard sculpt, black mask facial, and scalp massage.",
      price: 20000,
      durationMinutes: 90,
    },
  ],

  // 8. Staff / Barbers
  staff: [
    {
      id: "barber-tunde",
      name: "Tunde Adebayo",
      role: "Master Barber",
      specialty: "Skin fades & razor work",
    },
    {
      id: "barber-chidi",
      name: "Chidi Okafor",
      role: "Senior Stylist",
      specialty: "Beard sculpting & waves",
    },
    {
      id: "barber-malik",
      name: "Malik Ibrahim",
      role: "Barber",
      specialty: "Classic cuts & twists",
    },
  ],

  // 9. Automated Reminders (WhatsApp / SMS)
  reminders: {
    channel: "WhatsApp", // "WhatsApp" or "SMS"
    send24hBefore: true,
    send2hBefore: true,
    sendThankYouAfter: true,
    templates: {
      before24h: "Hi {name}, reminder from {shop}: your {service} with {barber} is tomorrow at {time}.",
      before2h: "Hi {name}, your {service} at {shop} starts in 2 hours ({time}) with {barber}. See you soon!",
      thankYou: "Thanks for visiting {shop}, {name}! Hope you love your fresh cut. Book anytime!",
    },
  },
};
