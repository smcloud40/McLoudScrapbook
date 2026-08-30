# Scrapbook

Real backend wired up: Supabase (auth + database) and Stripe (payments), deployed on Vercel.
The app deploys and renders fine before you do the steps below — auth and checkout will just
say "not configured" until you add the keys.

## 1. Create a Supabase project
1. Go to supabase.com, create a free project.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. In Project Settings > API, copy the Project URL, `anon` public key, and `service_role` key.
4. In Authentication > URL Configuration, add your production domain as a Redirect URL.

## 2. Create a Stripe account
1. Go to stripe.com, create an account (test mode is fine to start).
2. Copy your Secret key from Developers > API keys.
3. Once deployed, go to Developers > Webhooks, add an endpoint at
   `https://yourdomain.com/api/stripe-webhook`, subscribe to `checkout.session.completed`,
   and copy the signing secret.

## 3. Add environment variables in Vercel
Project Settings > Environment Variables, add all five from `.env.example`, then redeploy.

## 4. Point your domain at Vercel
Project Settings > Domains > Add your domain, then update the DNS records at your
registrar as Vercel instructs (usually an A record or CNAME).

## What's real vs. placeholder right now
- Auth, database schema, ownership, credits, and Stripe checkout/webhook: real and wired up.
- Sticker/background artwork: simple placeholder SVG shapes — swap in real illustrated
  assets via Supabase Storage and update `asset_url` in the `elements` table.
- Multi-page scrapbooks: schema supports it; the editor UI currently shows a single page —
  worth adding next.
