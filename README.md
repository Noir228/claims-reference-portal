# Claims Reference Portal

A clean, responsive public reference website based on the supplied design.

## What it does

### Public users
- Anyone with the website link can open it.
- Search codes/titles from the left search bar.
- Click a reference code to load its details.
- Click an attachment name to preview the document.
- PDF documents support page navigation.
- The magnifier opens a centered viewer with Zoom In, Zoom Out and Close.
- Visitors have no editing controls.

### Administrator
- Sign in with a Supabase Auth email/password account.
- Add or delete reference-code buttons.
- Edit code and title.
- Add, replace or remove attachments.
- Upload PDF or image documents.
- Changes are shared immediately with all visitors.

## Free hosting

A straightforward free setup is:

**Frontend:** GitHub Pages, Cloudflare Pages, or Netlify  
**Database/auth/file storage:** Supabase free plan

The website is static, so there is no server to maintain.

## Setup

### 1. Create Supabase project
Create a free project at https://supabase.com/

### 2. Configure the database
Open Supabase -> SQL Editor and run **supabase.sql** from this folder.

### 3. Create the administrator account
In Supabase:
Authentication -> Users -> Add user

Create your administrator email/password.

Copy the user's UUID and run:

```sql
insert into public.profiles (id, is_admin)
values ('YOUR-USER-UUID-HERE', true);
```

Do NOT put your administrator password in the website code.

### 4. Add Supabase keys
Open `app.js`.

Replace:

```js
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";
```

with the Project URL and anon/public key shown in:
Supabase -> Project Settings -> API.

The anon key is intended to be used in browser applications. The database policies in `supabase.sql` are what prevent visitors from changing data.

### 5. Test locally
You should serve the folder through a local web server rather than opening `index.html` directly.

For example, if Python is installed:

```bash
python -m http.server 8000
```

Then open:

http://localhost:8000

### 6. Publish free
Create a GitHub repository and upload:
- index.html
- styles.css
- app.js
- supabase.sql
- demo-document.png

Enable GitHub Pages for the repository.

The resulting `github.io` link can be shared with anyone.

## Important security note

The administrator password is NOT stored in this website.

Supabase Authentication handles login, and Row Level Security (RLS) makes the actual database/storage changes administrator-only.

The document bucket is public because the requested site is a public reference portal. Anyone who can access a document's public URL can view that document.

## Customization ideas

The code is deliberately structured so the visual design can be changed without changing the database:
- logo/portal name
- colors
- sidebar width
- card layout
- fonts
- document viewer appearance
- additional metadata columns
- categories/tags
- favorites/recently viewed
- print/download buttons
- mobile layout

The initial demo data includes the reference codes shown in the supplied screenshot.
