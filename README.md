# Scrapbook

Real backend wired up: Supabase (auth + database) and Stripe (payments), deployed on Vercel.
The app deploys and renders fine before you do the steps below — auth and checkout will just
say "not configured" until you add the keys.

## 1. Create a Supabase project
1. Go to supabase.com, create a free project.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`, then `supabase/admin.sql`.
3. In Project Settings > API, copy the Project URL, `anon` public key, and `service_role` key.
4. In Authentication > URL Configuration, add your production domain as a Redirect URL.

## 2. Make your wife an admin
1. Have her sign in once at `/login` on the live site (this creates her profile row automatically).
2. In the Supabase SQL editor, run:
   `update profiles set is_admin = true where id = (select id from auth.users where email = 'her-email@example.com');`
3. She can now visit `/admin` to create packs and upload stickers/backgrounds/fonts. Anything she
   adds there shows up in the editor's sidebar automatically — no redeploy needed, since the
   editor loads its catalog live from the database.

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
- Auth, database schema, ownership, credits, Stripe checkout/webhook, multi-page scrapbooks,
  autosave, and the admin catalog tools: all real and wired up.
- The seed data (`bg1`, `s4`, etc. from `supabase/seed.sql`) has no real artwork — those rows
  have `asset_url = null` and won't render. Either delete them via `/admin` or upload real
  images to those packs; anything the admin page creates going forward has real artwork from
  the start.
- Fonts show a Google Font by family name (typed into `/admin`, no font files to manage) —
  double check the family name matches Google Fonts exactly, since a typo just silently
  falls back to the browser default.
