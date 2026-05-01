# Supabase Setup

1. Open your Supabase project.
2. Go to **SQL Editor** and run `supabase-schema.sql`.
3. Go to **Project Settings > API**.
4. Copy your **Project URL** and **anon public key**.
5. Paste them into `ojeyt-tracker/js/supabase-config.js`.

```js
window.SUPABASE_CONFIG = {
  url: 'https://your-project-id.supabase.co',
  anonKey: 'your-anon-public-key',
};
```

For instant signup/login inside the app, go to **Authentication > Providers > Email** and turn off email confirmation while developing. If email confirmation is enabled, Supabase creates the account but the user must confirm their email before signing in.
