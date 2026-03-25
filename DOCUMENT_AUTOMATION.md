# HR document automation module

This project includes a **production-style document automation** layer for HR: **MongoDB** templates + runs, **Express** APIs, **React** admin UI (under **Automations → Document automation**), file uploads, **DOCX** merge with **docxtemplater**, **HTML preview** via Mammoth, **PDF** via Puppeteer, and an **optional OpenAI** step that only *suggests* placeholder keys (human review is always required).

## Architecture and library choices

| Concern | Choice | Why |
|--------|--------|-----|
| Template format | **DOCX ( OOXML )** | Reliable merge, legal/layout fidelity, industry standard for HR. |
| Merge engine | **docxtemplater + pizzip** | Battle-tested `{{mustache}}` substitution inside DOCX. |
| “Red = dynamic” | **XML scan + optional rewrite** | HR marks dynamic runs in red in Word; we detect red `<w:color>` runs and optionally rewrite matched text to `{{key}}` on a **working copy** (`working.docx`). Original is kept. |
| Preview | **Mammoth → HTML** | Fast, no extra desktop deps; good enough for admin review (not pixel-perfect vs Word). |
| PDF | **Puppeteer prints HTML** | Cross-platform vs LibreOffice; Chromium ships with `puppeteer`. If PDF fails, **DOCX still downloads** and `pdfError` is stored on the run. |
| AI | **`server/services/aiPlaceholders.js`** | Isolated module; uses **OpenAI** when `OPENAI_API_KEY` is set, otherwise **heuristic** keys from snippet text. Outputs are always **reviewed** in the UI. |

**PDF uploads as “reference only”** are not fully implemented in v1: binary PDF is poor for variable merge. The supported path is **author in Word (DOCX)** → upload → map → export. You can store a PDF alongside for compliance/archival by extending the template schema with `referencePdfPath` if needed.

## File layout

- `server/models.js` — `DocumentTemplate`, `DocumentAutomationRun`
- `server/documentAutomationRoutes.js` — routes + `ensureSampleDocumentTemplates` (used by seed)
- `server/services/documentStorage.js` — paths under `server/storage/document-automation/` (gitignored)
- `server/services/docxMerge.js` — merge
- `server/services/docxRedAndMustache.js` — red detection + red → `{{key}}` rewrite
- `server/services/docxToPdf.js` — Mammoth + Puppeteer
- `server/services/aiPlaceholders.js` — AI / heuristic abstraction
- `server/services/employeePlaceholderDefaults.js` — map `Employee` → common keys
- `server/buildSampleOfferLetterDocx.js` — programmatic sample DOCX
- `src/pages/DocumentAutomationHub.tsx` — Templates / Generate / History UI
- `src/lib/documentAutomationApi.ts` — API client

## Setup

1. **Environment** (see root `.env.example`):

   - `MONGODB_URI`, `PORT`, `JWT_SECRET`, `VITE_API_URL` as for the rest of HRMS.
   - Optional: `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`).

2. **Install** (includes Puppeteer/Chromium):

   ```bash
   npm install
   ```

3. **Seed sample template** (creates **Sample Offer Letter (Gluck)** when missing):

   ```bash
   npm run seed
   ```

4. **Run**:

   ```bash
   npm run dev:all
   ```

5. **UI**: log in as **Super Admin** or **HR Manager** → **Automations** → **Open document automation**.

Storage directory: `server/storage/document-automation/` (created automatically; listed in `.gitignore`).

## Example API payloads

All routes require `Authorization: Bearer <token>`. Roles: `super_admin`, `hr_manager`.

### Upload template (`multipart/form-data`)

```http
POST /api/document-automation/templates
Content-Type: multipart/form-data
```

Fields:

- `file` — `.docx`
- `name` — display name
- `description` (optional)
- `category` (optional)

### Detect placeholders

```json
POST /api/document-automation/templates/:id/detect
{ "useAi": true }
```

Response (abridged):

```json
{
  "suggestions": [
    {
      "key": "employee_full_name",
      "label": "Employee full name",
      "source": "ai",
      "exampleValue": "Jane Doe",
      "redSnippet": "Jane Doe"
    }
  ],
  "mustacheKeys": ["letter_date"],
  "redSnippets": ["Jane Doe"],
  "aiEnabled": true
}
```

### Save mapping (manual review)

```json
PATCH /api/document-automation/templates/:id
{
  "placeholders": [
    {
      "key": "employee_full_name",
      "label": "Full name",
      "source": "manual",
      "exampleValue": "Priya Jayasinghe",
      "redSnippet": "Candidate Name"
    }
  ],
  "status": "active"
}
```

### Prepare working DOCX (red text → `{{keys}}`)

```json
PATCH /api/document-automation/templates/:id
{
  "placeholders": [ /* same as above, redSnippet must match Word run text */ ],
  "commitMappings": true
}
```

### Preview merged HTML

```json
POST /api/document-automation/templates/:id/preview
{
  "values": {
    "employee_full_name": "Priya Jayasinghe",
    "letter_date": "24/03/2026",
    "job_title": "Admin Executive",
    "department": "Administration",
    "joining_date": "01/06/2024",
    "reporting_manager": "Ashan Perera",
    "salary_formatted": "LKR 55,000",
    "salary_type": "Fixed Monthly",
    "employee_address": "23 Dalada Veediya, Kandy"
  }
}
```

### Generate DOCX + PDF

```json
POST /api/document-automation/templates/:id/generate
{
  "values": { /* same shape as preview */ },
  "employeeId": "65f1c2e4b8d2a1001a2b3c4d",
  "outputPdf": true
}
```

Response (abridged):

```json
{
  "run": {
    "id": "...",
    "templateName": "Sample Offer Letter (Gluck)",
    "hasDocx": true,
    "hasPdf": true
  },
  "downloadDocxUrl": "/api/document-automation/runs/.../download?format=docx",
  "downloadPdfUrl": "/api/document-automation/runs/.../download?format=pdf"
}
```

### Employee default field values

```http
GET /api/document-automation/employee-defaults/:employeeId
```

Returns `{ "values": { "employee_full_name": "...", ... } }` aligned with `employeePlaceholderDefaults.js`.

## Sample offer letter placeholders

The seeded **Sample Offer Letter (Gluck)** uses at least:

`letter_date`, `employee_full_name`, `job_title`, `department`, `joining_date`, `reporting_manager`, `salary_formatted`, `salary_type`, `employee_address`.

## Operational notes

- **Word run splitting**: If Word splits red text across multiple `<w:t>` nodes, detection or “Prepare template” may miss a snippet; normalize text in Word or use explicit `{{placeholders}}` in black or red.
- **Chromium / Puppeteer**: First PDF on a cold server can be slow; ensure enough RAM for headless Chrome.
- **Security**: Downloads are authenticated; do not expose `/server/storage` via static HTTP without auth.
