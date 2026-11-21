import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { getStripe } from "../lib/stripe.js";
import { confirmBooking } from "../utils/confirmBooking.js";
import { STRIPE_CURRENCY, toStripeAmount } from "../utils/money.js";

function clientBaseUrl() {
  return (process.env.CLIENT_URLS || "http://localhost:3000").split(",")[0].trim().replace(/\/$/, "");
}

export async function createCheckout(req, res, next) {
  try {
    const { bookingId } = req.body ?? {};
    if (!bookingId || !ObjectId.isValid(bookingId)) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const db = await getDb();
    const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
    if (!booking || booking.customer?.id !== req.user.id) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.paymentStatus === "paid") {
      return res.status(409).json({ message: "Booking is already paid" });
    }
    if (booking.status !== "pending") {
      return res.status(409).json({ message: "Booking is no longer pending" });
    }
    if (!booking.holdExpiresAt || new Date(booking.holdExpiresAt) <= new Date()) {
      return res.status(409).json({ message: "The payment hold has expired" });
    }

    const stripe = getStripe();
    const image = booking.equipment?.image;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: STRIPE_CURRENCY,
            unit_amount: toStripeAmount(booking.totalAmount),
            product_data: {
              name: booking.equipment?.name || "Equipment rental",
              ...(typeof image === "string" && /^https:\/\//.test(image) ? { images: [image] } : {}),
            },
          },
        },
      ],
      metadata: { bookingId: String(booking._id) },
      customer_email: req.user.email || undefined,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${clientBaseUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientBaseUrl()}/payment/cancel?booking=${booking._id}`,
    });
    await db
      .collection("bookings")
      .updateOne({ _id: booking._id }, { $set: { checkoutSessionId: session.id, updatedAt: new Date() } });
    return res.json({ data: { url: session.url } });
  } catch (err) {
    return next(err);
  }
}

export async function confirmPayment(req, res, next) {
  try {
    const { sessionId } = req.body ?? {};
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });
    const db = await getDb();
    const { booking, payment } = await confirmBooking({
      db,
      stripe: getStripe(),
      sessionId,
      callerId: req.user.id,
    });
    return res.json({ data: { booking, payment } });
  } catch (err) {
    return next(err);
  }
}

export async function stripeWebhook(req, res, next) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: "Payments are not configured" });
    const signature = req.headers["stripe-signature"];
    let event;
    try {
      event = Stripe.webhooks.constructEvent(req.body, signature, secret);
    } catch {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }
    if (event.type === "checkout.session.completed") {
      try {
        const db = await getDb();
        await confirmBooking({ db, stripe: getStripe(), sessionId: event.data.object.id });
      } catch (err) {
        console.error(`webhook confirm failed for ${event.data.object.id}:`, err.message);
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    return next(err);
  }
}
