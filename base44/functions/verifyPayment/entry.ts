import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sessionId } = await req.json();

        // Retrieve the checkout session
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const tiersPassed = parseInt(session.metadata.tiersPassed);
            const currentPhotoCount = await base44.asServiceRole.entities.Photo.filter({ created_by: user.email }).then(photos => photos.length);
            const newPaidTier = Math.floor(currentPhotoCount / 250) + tiersPassed;

            // Update user's paid tier
            await base44.asServiceRole.entities.User.update(user.id, {
                paid_tier: newPaidTier
            });

            return Response.json({ success: true, paidTier: newPaidTier });
        } else {
            return Response.json({ success: false, error: 'Payment not completed' }, { status: 400 });
        }
    } catch (error) {
        console.error('Verify payment error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});