/**
 * Creates a Stripe Payment Intent for photo storage payment
 * @param {number} amount - Amount in dollars (e.g., 1 for $1.00)
 * @param {string} userEmail - User's email address
 * @returns {object} - Payment Intent client secret
 */
export default async function createPaymentIntent({ amount, userEmail }, context) {
  const stripe = require('stripe')(context.secrets.STRIPE_SECRET_KEY);
  
  try {
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe uses cents
      currency: 'usd',
      receipt_email: userEmail,
      metadata: {
        product: 'remembrain_photo_storage',
        user_email: userEmail,
        photos_purchased: amount * 250
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (error) {
    console.error('Stripe error:', error);
    throw new Error('Failed to create payment intent: ' + error.message);
  }
}