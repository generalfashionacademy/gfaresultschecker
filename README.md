# GFA Results Portal
Static site (HTML/CSS/JS) using Firebase Realtime Database (REST) and Paystack.

- `index.html`  – student results checker
- `admin.html`  – admin portal (username: `admin`, password: `GFA@123`)
- `js/config.js` – Firebase URL, Paystack PUBLIC key, admin hash

## Setup
1. Firebase console → Realtime Database → Rules → paste `database.rules.json` → Publish.
2. Open `index.html` (or host on Firebase Hosting / Netlify / any static host).
3. Admin → Settings → turn on the Paystack fee if you want students to pay.

## Notes
- PDFs are stored as base64 in the database (max 2MB each). For many/large PDFs, switch to Firebase Storage.
- Never put the Paystack secret key in this code. Verify payments server-side if you need strict enforcement.
