# Gluck HR Hub — HRMS

HR management system: **React (Vite) + Express + MongoDB**

## Folder Structure

```
gluck-hr-hub/
├── frontend/                  # React + Vite frontend
│   ├── public/                # Static assets (logo, favicon)
│   ├── src/
│   │   ├── components/        # UI components (shadcn/ui + shared)
│   │   ├── contexts/          # AuthContext
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # API clients, utilities
│   │   ├── pages/             # All page components
│   │   └── types/             # TypeScript types
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── backend/                   # Express + MongoDB API
│   ├── routes/
│   │   ├── hrData.js          # HR data (employees, attendance, leaves, payroll)
│   │   ├── documentAutomation.js  # Document template engine
│   │   └── email.js           # Email sending routes
│   ├── services/
│   │   ├── aiPlaceholders.js
│   │   ├── docxMerge.js
│   │   ├── docxRedAndMustache.js
│   │   ├── docxToPdf.js
│   │   ├── documentStorage.js
│   │   ├── employeePlaceholderDefaults.js
│   │   ├── pdfPlaceholders.js
│   │   └── simpleDocxMerge.js
│   ├── index.js               # Express app entry
│   ├── models.js              # Mongoose models
│   └── seed.js                # Demo data seeder
├── dist/                      # Production build output (git-ignored)
├── .env                       # Local secrets (git-ignored)
├── .env.example               # Environment variable template
└── package.json
```

## Quick Setup

1. Copy `.env.example` → `.env` and fill in `MONGODB_URI`, `JWT_SECRET`
2. `npm install`
3. `npm run seed` — seeds demo users and a sample offer letter template
4. `npm run dev:all` — starts API (`:3001`) + Vite dev server (`:8080`) together

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:all` | Start API + frontend dev server concurrently |
| `npm run dev` | Frontend only (Vite, port 8080) |
| `npm run server` | Backend only (nodemon watch, port 3001) |
| `npm run build` | Production frontend build → `dist/` |
| `npm run start` | Start backend in production mode |
| `npm run seed` | Seed demo data to MongoDB |

## Production Deployment

1. Set all env vars in `.env` (see `.env.example`)
2. `npm run build` — generates `dist/`
3. Serve `dist/` via Nginx / CDN, proxy `/api` → Express on port `3001`
4. `npm run start` — start the Express API

## First-time Setup

Use `POST /api/auth/bootstrap` when the database has zero users (check server logs on first start).

## Optional Features

- **AI placeholder naming** — set `OPENAI_API_KEY` in `.env`
- **High-fidelity PDF export** — install [LibreOffice](https://www.libreoffice.org/) and set `LIBREOFFICE_PATH`
- **Email sending** — set `EMAIL_FROM` + `EMAIL_PASS` (Gmail App Password)
- **Google Chat notifications** — set `GCHAT_WEBHOOK_URL`
