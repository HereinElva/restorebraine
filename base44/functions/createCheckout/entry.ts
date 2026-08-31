import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

/** Hosted web app — Stripe success/cancel URLs return to the caller's verified domain. */
const WEB_APP_URL = 'https://restorebraine.base44.app';
const APP_HOSTS = ['restorebraine.base44.app', 'restorebraine.com', 'www.restorebraine.com'];

function resolveReturnBase(req: Request, returnUrl?: string) {
  const origin = req.headers.get('origin') || '';
  const candidate = returnUrl || origin || WEB_APP_URL;

  for (const host of APP_HOSTS) {
    if (candidate.includes(host)) {
      try {
        const parsed = new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        return WEB_APP_URL;
      }
    }
  }
  if (candidate.includes('localhost')) {
    try {
      const parsed = new URL(candidate);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return WEB_APP_URL;
    }
  }
  return WEB_APP_URL;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { amount, tiersPassed, returnUrl } = await req.json();
        const returnBase = resolveReturnBase(req, returnUrl);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Restorebraine Storage',
                            description: `Storage for ${tiersPassed * 250} additional photos/videos`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            customer_email: user.email,
            metadata: {
                user_id: user.id,
                user_email: user.email,
                tiersPassed: tiersPassed.toString(),
            },
            success_url: `${returnBase}/PaymentSuccess?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnBase}/Upload`,
        });

        return Response.json({ url: session.url });
    } catch (error) {
        console.error('Checkout error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
