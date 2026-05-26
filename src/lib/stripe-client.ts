import { loadStripe } from "@stripe/stripe-js";

// Singleton — must be created outside of component render
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);
