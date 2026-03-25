# Gluck HR Hub (MERN HRMS)

HR management app: **React (Vite) + Express + MongoDB**. Run API and web together with `npm run dev:all`.

## Quick setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_SECRET`, and `VITE_API_URL` (e.g. `http://localhost:3001`).
2. `npm install`
3. `npm run seed` — demo users, automations, and a **sample offer letter** template for [document automation](./DOCUMENT_AUTOMATION.md).
4. `npm run dev:all` — API (default `:3001`) and Vite dev server.

First-time production: use `POST /api/auth/bootstrap` when the database has zero users (see server logs).

## Document automation

HR can upload **DOCX** templates, map **dynamic** fields (red text in Word and/or `{{mustache}}` placeholders), preview merged HTML, export **DOCX/PDF**, and view history. Details, API examples, and architecture notes:

**[DOCUMENT_AUTOMATION.md](./DOCUMENT_AUTOMATION.md)**

Optional AI-assisted key naming: set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) on the server.
