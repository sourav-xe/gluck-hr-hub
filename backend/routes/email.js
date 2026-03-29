import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { EmailTemplate } from '../models.js';

const memStorage = multer.memoryStorage();
const emailUpload = multer({ storage: memStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const WORKSPACE_TEMPLATE = {
  name: 'Google Workspace Credentials',
  subject: 'Google Workspace Credentials',
  category: 'Onboarding',
  isDefault: true,
  variables: ['name', 'email', 'password'],
  body: `Dear {{name}},

Please find below your workplace login credentials.

Email - {{email}}
Password - {{password}}

Kindly log in using the details provided.

This will serve as your official email address, and you are required to carry out all office-related communication and work through this email moving forward.

If you face any issues logging in, feel free to reach out.

Best Regards,
Glück Global`,
};

function extractVariables(body, subject) {
  const matches = [...(body + ' ' + subject).matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

function renderTemplate(text, values) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

function createTransporter() {
  const user = (process.env.EMAIL_FROM || '').trim();
  // Strip spaces — Gmail App Passwords are shown with spaces but used without
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // true = 465, false = 587 STARTTLS
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

export function registerEmailRoutes(app, authMiddleware) {
  /* ── Reset to single canonical template on every boot ─────────────────────── */
  (async () => {
    try {
      await EmailTemplate.deleteMany({});
      await EmailTemplate.create(WORKSPACE_TEMPLATE);
      console.log('[Email] Reset to Google Workspace Credentials template');
    } catch (e) {
      console.error('[Email] Seed error:', e.message);
    }
  })();

  /* ── GET /api/email-templates ─────────────────────────────────────────────── */
  app.get('/api/email-templates', authMiddleware, async (_req, res) => {
    try {
      const templates = await EmailTemplate.find().sort({ createdAt: -1 });
      res.json(
        templates.map((t) => ({
          id: t._id.toString(),
          name: t.name,
          subject: t.subject,
          body: t.body,
          variables: t.variables,
          category: t.category,
          isDefault: t.isDefault,
          createdAt: t.createdAt,
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ── POST /api/email-templates ────────────────────────────────────────────── */
  app.post('/api/email-templates', authMiddleware, async (req, res) => {
    try {
      const { name, subject, body, category } = req.body || {};
      if (!name?.trim() || !subject?.trim() || !body?.trim()) {
        return res.status(400).json({ error: 'name, subject and body are required' });
      }
      const variables = extractVariables(body, subject);
      const t = await EmailTemplate.create({
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        variables,
        category: category?.trim() || 'General',
        isDefault: false,
      });
      res.status(201).json({
        id: t._id.toString(),
        name: t.name,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        category: t.category,
        isDefault: t.isDefault,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ── PUT /api/email-templates/:id ─────────────────────────────────────────── */
  app.put('/api/email-templates/:id', authMiddleware, async (req, res) => {
    try {
      const rawId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(rawId)) {
        return res.status(400).json({ error: 'Invalid template id' });
      }
      const existing = await EmailTemplate.findById(rawId);
      if (!existing) return res.status(404).json({ error: 'Template not found' });

      const { name, subject, body, category } = req.body || {};
      const nextName = name !== undefined ? String(name).trim() : existing.name;
      const nextSubject = subject !== undefined ? String(subject).trim() : existing.subject;
      const nextBody = body !== undefined ? String(body).trim() : existing.body;
      const nextCategory =
        category !== undefined ? String(category).trim() : (existing.category || 'General');

      if (!nextName || !nextSubject || !nextBody) {
        return res.status(400).json({ error: 'Name, subject, and body are required and cannot be empty.' });
      }

      const variables = extractVariables(nextBody, nextSubject);
      const t = await EmailTemplate.findByIdAndUpdate(
        rawId,
        {
          name: nextName,
          subject: nextSubject,
          body: nextBody,
          category: nextCategory || 'General',
          variables,
        },
        { new: true, runValidators: true }
      );
      if (!t) return res.status(404).json({ error: 'Template not found' });
      res.json({
        id: t._id.toString(),
        name: t.name,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        category: t.category,
        isDefault: t.isDefault,
      });
    } catch (e) {
      if (e.name === 'ValidationError') {
        const msgs = Object.values(e.errors || {}).map((er) => er.message);
        return res.status(400).json({ error: msgs.join(' ') || e.message });
      }
      res.status(500).json({ error: e.message });
    }
  });

  /* ── DELETE /api/email-templates/:id ──────────────────────────────────────── */
  app.delete('/api/email-templates/:id', authMiddleware, async (req, res) => {
    try {
      await EmailTemplate.findByIdAndDelete(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ── POST /api/email/send ─────────────────────────────────────────────────── */
  app.post('/api/email/send', authMiddleware, emailUpload.array('attachments', 10), async (req, res) => {
    try {
      const transporter = createTransporter();
      if (!transporter) {
        return res.status(503).json({
          ok: false,
          error: 'Email not configured. Set EMAIL_FROM and EMAIL_PASS in your .env file.',
        });
      }

      const { to, templateId, subject: customSubject, body: customBody, variables: rawVars } = req.body || {};
      if (!to?.trim()) return res.status(400).json({ ok: false, error: 'Recipient email (to) is required' });

      let finalSubject = customSubject || '';
      let finalBody = customBody || '';

      if (templateId) {
        const tpl = await EmailTemplate.findById(templateId);
        if (!tpl) return res.status(404).json({ ok: false, error: 'Template not found' });
        const vars = rawVars ? (typeof rawVars === 'string' ? JSON.parse(rawVars) : rawVars) : {};
        finalSubject = renderTemplate(tpl.subject, vars);
        finalBody = renderTemplate(tpl.body, vars);
      }

      if (!finalSubject.trim()) return res.status(400).json({ ok: false, error: 'Subject is required' });
      if (!finalBody.trim()) return res.status(400).json({ ok: false, error: 'Body is required' });

      const attachments = (req.files || []).map((f) => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype,
      }));

      const isHtml = /<[a-z][\s\S]*>/i.test(finalBody);
      const mailOptions = {
        from: `"Gluck Global HR" <${process.env.EMAIL_FROM}>`,
        to: to.trim(),
        subject: finalSubject,
        ...(isHtml ? { html: finalBody } : { text: finalBody }),
        attachments,
      };

      await transporter.sendMail(mailOptions);
      res.json({ ok: true, message: `Email sent to ${to.trim()}` });
    } catch (e) {
      console.error('[Email] Send error:', e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  /* ── GET /api/email/config-status ─────────────────────────────────────────── */
  app.get('/api/email/config-status', authMiddleware, (_req, res) => {
    const configured = !!(process.env.EMAIL_FROM?.trim() && process.env.EMAIL_PASS?.trim());
    res.json({ configured, emailFrom: configured ? process.env.EMAIL_FROM.trim() : null });
  });

  /* ── POST /api/email/verify ────────────────────────────────────────────────── */
  app.post('/api/email/verify', authMiddleware, async (_req, res) => {
    const transporter = createTransporter();
    if (!transporter) {
      return res.json({ ok: false, error: 'EMAIL_FROM and EMAIL_PASS are not set in .env' });
    }
    try {
      await transporter.verify();
      res.json({ ok: true, message: `SMTP connection verified for ${process.env.EMAIL_FROM?.trim()}` });
    } catch (e) {
      let hint = '';
      const msg = e.message || '';
      if (msg.includes('BadCredentials') || msg.includes('Username and Password')) {
        hint = 'Your App Password is incorrect or expired. Generate a new one at: myaccount.google.com/apppasswords — make sure 2-Step Verification is enabled first.';
      } else if (msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
        hint = 'Cannot reach Gmail SMTP. Check your internet connection or try setting EMAIL_PORT=465 and EMAIL_SECURE=true in .env.';
      } else if (msg.includes('self signed') || msg.includes('certificate')) {
        hint = 'TLS certificate error. Add EMAIL_SECURE=true to your .env.';
      }
      res.json({ ok: false, error: msg, hint });
    }
  });
}
