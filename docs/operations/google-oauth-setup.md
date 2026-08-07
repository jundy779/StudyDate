# Google Sign-In (Supabase Auth)

StudyDate uses **Supabase Auth → Google provider**. The app already shows
“Lanjutkan dengan Google” on `/login`. Owner must enable the provider before
the button works in production.

## 1. Google Cloud Console

1. Create (or reuse) a Google Cloud project.
2. APIs & Services → OAuth consent screen (External or Internal as appropriate).
3. Create OAuth Client ID → Web application.
4. Authorized JavaScript origins:
   - `https://studydateid.vercel.app`
   - `http://localhost:3010` (local)
   - later `https://studydate.id`
5. Authorized redirect URIs — use the **Supabase callback**, not the Next.js URL:
   - `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
   - StudyDate ref: `https://ctbqudtvrfezuoqcecyj.supabase.co/auth/v1/callback`

Copy Client ID and Client Secret.

## 2. Supabase Dashboard

Authentication → Providers → **Google** → Enable:

- Client ID / Client Secret from Google Cloud
- Save

Authentication → URL Configuration (already required for magic links):

- Site URL = live origin (`https://studydateid.vercel.app` or `https://studydate.id`)
- Redirect URLs include:
  - `https://YOUR_ORIGIN/auth/callback`
  - `https://YOUR_ORIGIN/auth/confirm`

## 3. Domain allowlist (product rule)

Public signup/login (email + Google) only accepts:

- `@gmail.com`
- `@vk.com`
- emails ending in `.ac.id` or `.sch.id`

After Google returns, `/auth/callback` checks the email. Unsupported domains are
signed out and sent back to `/login` with an error.

Staff login (`/staff/login`) is separate and is **not** limited by this list.

## 4. Smoke

1. `/login` → Lanjutkan dengan Google → account `@gmail.com` → onboarding or `/app`
2. Google account with unsupported domain → blocked with clear message
3. Magic link with `nama@yahoo.com` → rejected before send
