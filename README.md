# Rayan Tech Solution workspace

A responsive login page and empty dashboard, in electric blue and cyan with an animated SVG motherboard background. No installation is required; use Node.js and run `npm run dev`, then open http://localhost:5173.

## Folder structure

```text
dist/                      Browser-ready application
  index.html               Entry point
  assets/                  Brand favicon
  styles/main.css          Theme, layout, responsive styles and animation
  src/
    app.js                 Navigation and page interactions
    config.js              Public Supabase connection settings
    components/            Shared brand and circuit artwork
    pages/                 Login and dashboard views
    services/auth.js        Supabase sign-in/sign-out requests
scripts/                   Local server and validation
```

## Connect your Supabase project

In `dist/src/config.js`, enter your project URL and public publishable key (or legacy anon key). Never use a service-role or secret key. Create your team users in Supabase Authentication. The login uses Supabase email/password authentication. The app keeps the session only in memory, so refreshing requires signing in again. Persistent sessions and password recovery are outside this initial scope.

Until configured, a clearly marked dashboard preview is available without credentials. It contains no data and is not an authenticated session. Once configured, this preview button is removed. The dashboard is intentionally empty; no database tables or records are created. When adding real data, enforce authorization with Supabase Row Level Security; browser navigation is not a database security boundary.

Run `npm run check` to validate JavaScript syntax and required assets. Google Fonts are optional; the design falls back to system fonts if unavailable. Animations respect reduced-motion preferences.
