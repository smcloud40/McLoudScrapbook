import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return Response.json({ error: 'Stripe webhook not configured' }, { status: 501 });
  }

  const stripe = new Stripe(secretKey);
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return Response.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, packIds, creditId } = session.metadata || {};
    const admin = getSupabaseAdmin();

    if (admin && userId && packIds) {
      const ids = JSON.parse(packIds);
      const rows = ids.map((packId) => ({
        user_id: userId,
        pack_id: packId,
        purchase_type: creditId ? 'credit' : 'cash',
      }));
      await admin.from('user_owned_packs').upsert(rows, { onConflict: 'user_id,pack_id' });

      if (creditId) {
        await admin.from('credits').update({ redeemed_at: new Date().toISOString() }).eq('id', creditId);
      }
    }
  }

  return Response.json({ received: true });
}
