# Supabase Auth Integration Guide (Login + Sign Up)

This project now includes:

- `pages/signup.js` for account registration
- `pages/login.js` for account login
- `styles/auth.module.css` for theme-aligned auth styling

Both pages already use `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`.

## 1) Configure Environment Variables

Your `lib/supabaseClient.js` expects these variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Place them in `.env.local`, then restart the dev server.

## 2) Enable Email/Password Auth in Supabase

In your Supabase dashboard:

1. Go to **Authentication > Providers**
2. Enable **Email**
3. Keep **Confirm email** ON (recommended for production)

If email confirmation is enabled, users must verify first before they can fully sign in.

## 3) Test the Pages

Run:

```bash
npm run dev
```

Then open:

- `http://localhost:3000/signup`
- `http://localhost:3000/login`

### Sign-up flow

- User enters full name, email, and password
- `signup.js` calls:
  - `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- Supabase creates a user in `auth.users`
- `full_name` is stored in user metadata

### Login flow

- User enters email and password
- `login.js` calls:
  - `supabase.auth.signInWithPassword({ email, password })`
- On success, page redirects to `/`

## 4) (Optional) Create a `profiles` Table

If you want app-specific user data (avatar, preferences, etc.), create a `profiles` table and connect it to the auth user id.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id);
```

## 5) Auto-create Profile Rows (Recommended)

Run this SQL in Supabase SQL Editor:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Now every successful signup automatically creates a profile record.

## 6) Read Current Logged-in User

Use this in any page/component:

```js
const { data, error } = await supabase.auth.getUser()
const user = data?.user
```

## 7) Add Logout Button

Use this action for sign out:

```js
await supabase.auth.signOut()
```

Then redirect the user to `/login` or landing page.

## 8) Protect Pages (Optional Next Step)

To require authentication for pages like `/plan`, check session on load:

```js
const { data } = await supabase.auth.getSession()
if (!data.session) router.push('/login')
```

For stronger protection, add middleware later to block unauthenticated routes.
