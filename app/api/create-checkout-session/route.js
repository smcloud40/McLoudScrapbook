import Stripe from 'stripe';
import { PACKS } from '../../../lib/packs';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json(
      { error: 'Stripe is not configured yet — add STRIPE_SECRET_KEY in Vercel.' },
      { status: 501 }
    );
  }

  const { userId, packIds, useCredit } = await req.json();
  if (!userId || !Array.isArray(packIds) || packIds.length === 0) {
    return Response.json({ error: 'Missing userId or packIds' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const stripe = new Stripe(secretKey);

  // Find out if this user is a subscriber (for the 50% discount) and whether
  // they have an unredeemed, unexpired credit (oldest first, FIFO).
  let isSubscriber = false;
  let creditId = null;
  if (admin) {
    const { data: profile } = await admin.from('profiles').select('is_subscriber').eq('id', userId).single();
    isSubscriber = !!profile?.is_subscriber;

    if (useCredit) {
      const { data: credit } = await admin
        .from('credits')
        .select('id')
        .eq('user_id', userId)
        .is('redeemed_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('issued_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      creditId = credit?.id ?? null;
    }
  }

  // Build line items: real prices only come from PACKS, never the client.
  const lineItems = [];
  packIds.forEach((id, index) => {
    const pack = PACKS[id];
    if (!pack || pack.free) return;
    const applyCredit = creditId && index === 0;
    const unitAmount = applyCredit ? 0 : isSubscriber ? Math.round(pack.priceCents * 0.5) : pack.priceCents;
    if (unitAmount === 0 && !applyCredit) return; // nothing to charge for
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: pack.name },
        unit_amount: Math.max(unitAmount, 0),
      },
      quantity: 1,
    });
  });

  const origin = req.headers.get('origin') || '';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems.length ? lineItems : [{
      price_data: { currency: 'usd', product_data: { name: 'Pack bundle' }, unit_amount: 0 },
      quantity: 1,
    }],
    success_url: `${origin}/editor?purchase=success`,
    cancel_url: `${origin}/editor?purchase=cancelled`,
    metadata: {
      userId,
      packIds: JSON.stringify(packIds),
      creditId: creditId || '',
    },
  });

  return Response.json({ url: session.url });
}
