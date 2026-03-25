import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import { User, Employee, AnnouncementSettings, SimpleDocTemplate, Festival } from './models.js';
import { analyzeDocxPlaceholders } from './services/docxRedAndMustache.js';
import { registerHrDataRoutes } from './hrDataRoutes.js';
import { registerDocumentAutomationRoutes } from './documentAutomationRoutes.js';

const PORT = Number(process.env.PORT || 3001);
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const GCHAT_WEBHOOK_URL = process.env.GCHAT_WEBHOOK_URL || '';

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment (.env)');
  process.exit(1);
}

function signToken(payload) {
  const body = JSON.stringify({
    ...payload,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  const data = Buffer.from(body).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload?.userId) return res.status(401).json({ error: 'Unauthorized' });
  req.auth = payload;
  next();
}

function serializeEmployee(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    fullName: o.fullName,
    email: o.email,
    phone: o.phone || '',
    type: o.type,
    department: o.department,
    jobTitle: o.jobTitle,
    reportingManagerId: o.reportingManagerId || undefined,
    joiningDate: o.joiningDate,
    dateOfBirth: o.dateOfBirth || '',
    salaryType: o.salaryType,
    salaryAmount: o.salaryAmount,
    bankName: o.bankName || '',
    accountNumber: o.accountNumber || '',
    accountHolderName: o.accountHolderName || '',
    ifscCode: o.ifscCode || '',
    address: o.address || '',
    permanentAddress: o.permanentAddress || '',
    nationality: o.nationality || '',
    passportNumber: o.passportNumber || undefined,
    bloodGroup: o.bloodGroup || '',
    maritalStatus: o.maritalStatus || '',
    aadhaarNumber: o.aadhaarNumber || '',
    panNumber: o.panNumber || '',
    pfNumber: o.pfNumber || '',
    uanNumber: o.uanNumber || '',
    emergencyContactName: o.emergencyContactName || '',
    emergencyContactRelation: o.emergencyContactRelation || '',
    emergencyContactPhone: o.emergencyContactPhone || '',
    previousCompany: o.previousCompany || '',
    previousSalary: o.previousSalary || '',
    status: o.status,
    avatar: o.avatar || undefined,
    onboardingComplete: o.onboardingComplete ?? null,
    onboardingStep: o.onboardingStep ?? 0,
  };
}

const SELF_SERVICE_ROLES = ['employee', 'freelancer_intern', 'reporting_manager'];

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function userResponse(userDoc, employeeDoc) {
  const email = userDoc.email || '';
  const normalizedRole = normalizeRole(userDoc.app_role);
  const isSelfService = SELF_SERVICE_ROLES.includes(normalizedRole);
  let onboardingComplete = null;
  let needsOnboarding = false;

  if (employeeDoc && isSelfService) {
    onboardingComplete = employeeDoc.onboardingComplete ?? null;
    if (onboardingComplete === false) {
      // Explicitly flagged – must complete
      needsOnboarding = true;
    } else if (onboardingComplete === null) {
      // Legacy employee: also require onboarding if profile is empty
      const hasPhone = !!(employeeDoc.phone || '').trim();
      const hasAddress = !!(employeeDoc.address || '').trim();
      if (!hasPhone && !hasAddress) needsOnboarding = true;
    }
  }

  return {
    id: userDoc._id.toString(),
    name: userDoc.fullName || (email ? email.split('@')[0] : 'User'),
    email,
    role: normalizedRole || 'employee',
    employeeId: userDoc.employeeId ? userDoc.employeeId.toString() : undefined,
    onboardingComplete,
    needsOnboarding,
  };
}

function formatYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonthDay(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}

function parseDateParts(raw) {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return { y, m, d };
  }
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(v)) {
    const [d, m, y] = v.split(/[/-]/).map(Number);
    return { y, m, d };
  }
  return null;
}

function applyTemplate(template, vars) {
  let out = String(template || '');
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v ?? ''));
  }
  return out.trim();
}

function cleanTemplateList(list, fallback) {
  const arr = Array.isArray(list) ? list : [];
  const out = arr.map((v) => String(v || '').trim()).filter(Boolean);
  if (out.length > 0) return out;
  const fb = String(fallback || '').trim();
  return fb ? [fb] : [];
}

function pickNextTemplate(list, lastIndex) {
  const templates = cleanTemplateList(list, '');
  if (templates.length === 0) return { template: '', nextIndex: -1 };
  if (templates.length === 1) return { template: templates[0], nextIndex: 0 };
  const nextIndex = ((Number(lastIndex) || -1) + 1) % templates.length;
  return { template: templates[nextIndex], nextIndex };
}

async function getOrCreateAnnouncementSettings() {
  let s = await AnnouncementSettings.findOne();
  if (!s) s = await AnnouncementSettings.create({});
  return s;
}

async function sendToGoogleChat(text) {
  const prefix = 'From HRMS-GluckGlobal';
  const bodyText = String(text || '').trim();
  const withSource = bodyText.startsWith(prefix) ? bodyText : `${prefix}\n\n${bodyText}`;
  if (!GCHAT_WEBHOOK_URL) {
    return { ok: false, error: 'GCHAT_WEBHOOK_URL is not configured on server' };
  }
  const response = await fetch(GCHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ text: withSource }),
  });
  if (!response.ok) {
    const err = await response.text();
    return { ok: false, error: `Google Chat webhook failed: ${response.status}`, detail: err };
  }
  return { ok: true };
}

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
app.use(
  cors({
    origin: FRONTEND_ORIGIN
      ? FRONTEND_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
      : true,
    credentials: true,
  })
);
// Allow onboarding document payloads (base64 files can exceed default 100kb).
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

/** First-time setup: only when database has zero users */
app.post('/api/auth/bootstrap', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      return res.status(403).json({ error: 'Bootstrap already completed' });
    }
    const { email, password, fullName } = req.body || {};
    if (!email?.trim() || !password || password.length < 6) {
      return res.status(400).json({ error: 'Valid email and password (min 6 chars) required' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.trim().toLowerCase(),
      passwordHash,
      fullName: fullName?.trim() || 'Admin',
      app_role: 'super_admin',
    });
    const token = signToken({ userId: user._id.toString() });
    res.status(201).json({ token, user: userResponse(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Bootstrap failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.passwordHash || typeof user.passwordHash !== 'string') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    let ok = false;
    try {
      ok = await bcrypt.compare(password, user.passwordHash);
    } catch (compareErr) {
      console.error('[login] bcrypt compare error:', compareErr.message);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    const token = signToken({ userId: user._id.toString() });
    let empDoc = null;
    if (user.employeeId) {
      empDoc = await Employee.findById(user.employeeId).select('onboardingComplete onboardingStep phone address').lean();
    }
    res.json({ token, user: userResponse(user, empDoc) });
  } catch (e) {
    console.error('[login]', e);
    res.status(500).json({ error: e.message || 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    let empDoc = null;
    if (user.employeeId) {
      empDoc = await Employee.findById(user.employeeId).select('onboardingComplete onboardingStep phone address').lean();
    }
    res.json({ user: userResponse(user, empDoc) });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/integrations/gchat/send', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.auth.userId).lean();
    if (!me || me.app_role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can send Google Chat messages' });
    }
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message text is required' });
    if (text.length > 4000) return res.status(400).json({ error: 'Message is too long (max 4000 characters)' });

    const sent = await sendToGoogleChat(text);
    if (!sent.ok) return res.status(502).json(sent);

    res.json({ ok: true });
  } catch (e) {
    console.error('[gchat-send]', e);
    res.status(500).json({ error: 'Failed to send Google Chat message' });
  }
});

app.get('/api/settings/announcements', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.auth.userId).lean();
    if (!me || me.app_role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    const s = await getOrCreateAnnouncementSettings();
    res.json({
      birthdayTemplates: cleanTemplateList(s.birthdayTemplates, s.birthdayTemplate),
      festivalTemplates: cleanTemplateList(s.festivalTemplates, s.festivalTemplate),
      birthdayTemplate: s.birthdayTemplate,
      festivalTemplate: s.festivalTemplate,
      festivalName: s.festivalName,
      festivalMonthDay: s.festivalMonthDay,
      autoBirthdayEnabled: s.autoBirthdayEnabled,
      autoFestivalEnabled: s.autoFestivalEnabled,
      lastBirthdayRunOn: s.lastBirthdayRunOn,
      lastFestivalRunOn: s.lastFestivalRunOn,
      lastBirthdayTemplateIndex: s.lastBirthdayTemplateIndex,
      lastFestivalTemplateIndex: s.lastFestivalTemplateIndex,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load announcement settings' });
  }
});

app.put('/api/settings/announcements', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.auth.userId).lean();
    if (!me || me.app_role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    const b = req.body || {};
    const s = await getOrCreateAnnouncementSettings();
    if (b.birthdayTemplates !== undefined) s.birthdayTemplates = cleanTemplateList(b.birthdayTemplates, s.birthdayTemplate);
    if (b.festivalTemplates !== undefined) s.festivalTemplates = cleanTemplateList(b.festivalTemplates, s.festivalTemplate);
    if (b.birthdayTemplate !== undefined) s.birthdayTemplate = String(b.birthdayTemplate);
    if (b.festivalTemplate !== undefined) s.festivalTemplate = String(b.festivalTemplate);
    if (b.festivalName !== undefined) s.festivalName = String(b.festivalName);
    if (b.festivalMonthDay !== undefined) s.festivalMonthDay = String(b.festivalMonthDay);
    if (b.autoBirthdayEnabled !== undefined) s.autoBirthdayEnabled = !!b.autoBirthdayEnabled;
    if (b.autoFestivalEnabled !== undefined) s.autoFestivalEnabled = !!b.autoFestivalEnabled;
    if (b.lastBirthdayTemplateIndex !== undefined) s.lastBirthdayTemplateIndex = Number(b.lastBirthdayTemplateIndex) || 0;
    if (b.lastFestivalTemplateIndex !== undefined) s.lastFestivalTemplateIndex = Number(b.lastFestivalTemplateIndex) || 0;
    if (!s.birthdayTemplates?.length) s.birthdayTemplates = cleanTemplateList([], s.birthdayTemplate);
    if (!s.festivalTemplates?.length) s.festivalTemplates = cleanTemplateList([], s.festivalTemplate);
    s.updatedByUserId = String(me._id);
    await s.save();
    res.json({
      birthdayTemplates: cleanTemplateList(s.birthdayTemplates, s.birthdayTemplate),
      festivalTemplates: cleanTemplateList(s.festivalTemplates, s.festivalTemplate),
      birthdayTemplate: s.birthdayTemplate,
      festivalTemplate: s.festivalTemplate,
      festivalName: s.festivalName,
      festivalMonthDay: s.festivalMonthDay,
      autoBirthdayEnabled: s.autoBirthdayEnabled,
      autoFestivalEnabled: s.autoFestivalEnabled,
      lastBirthdayRunOn: s.lastBirthdayRunOn,
      lastFestivalRunOn: s.lastFestivalRunOn,
      lastBirthdayTemplateIndex: s.lastBirthdayTemplateIndex,
      lastFestivalTemplateIndex: s.lastFestivalTemplateIndex,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save announcement settings' });
  }
});

app.post('/api/announcements/trigger', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.auth.userId).lean();
    if (!me || me.app_role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    const body = req.body || {};
    const mode = String(body.mode || '');
    const s = await getOrCreateAnnouncementSettings();

    if (mode === 'manual') {
      const text = String(body.message || '').trim();
      if (!text) return res.status(400).json({ error: 'Manual message is required' });
      const sent = await sendToGoogleChat(text);
      if (!sent.ok) return res.status(502).json(sent);
      return res.json({ ok: true, sentCount: 1 });
    }

    if (mode === 'birthday') {
      const customName = String(body.name || '').trim();
      const birthdayTemplates = cleanTemplateList(s.birthdayTemplates, s.birthdayTemplate);
      const explicitIndex = Number(body.templateIndex);
      const hasExplicit = Number.isInteger(explicitIndex) && explicitIndex >= 0 && explicitIndex < birthdayTemplates.length;
      const selected = hasExplicit
        ? { template: birthdayTemplates[explicitIndex], nextIndex: explicitIndex }
        : pickNextTemplate(birthdayTemplates, s.lastBirthdayTemplateIndex);
      const birthdayTpl = selected.template || s.birthdayTemplate;
      if (customName) {
        const text = applyTemplate(birthdayTpl, { name: customName });
        const sent = await sendToGoogleChat(text);
        if (!sent.ok) return res.status(502).json(sent);
        if (!hasExplicit) s.lastBirthdayTemplateIndex = selected.nextIndex;
        await s.save();
        return res.json({ ok: true, sentCount: 1, usedTemplateIndex: selected.nextIndex });
      }

      const md = formatMonthDay(new Date());
      const employees = await Employee.find({ status: 'Active' }).select('fullName dateOfBirth').lean();
      const todayBirthdays = employees.filter((e) => {
        const p = parseDateParts(e.dateOfBirth);
        if (!p) return false;
        return `${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` === md;
      });
      let sentCount = 0;
      for (const emp of todayBirthdays) {
        const text = applyTemplate(birthdayTpl, { name: emp.fullName });
        const sent = await sendToGoogleChat(text);
        if (sent.ok) sentCount += 1;
      }
      if (!hasExplicit) s.lastBirthdayTemplateIndex = selected.nextIndex;
      await s.save();
      return res.json({ ok: true, sentCount, usedTemplateIndex: selected.nextIndex });
    }

    if (mode === 'festival') {
      const festivalName = String(body.festivalName || s.festivalName || '').trim();
      if (!festivalName) return res.status(400).json({ error: 'Festival name is required' });
      const festivalTemplates = cleanTemplateList(s.festivalTemplates, s.festivalTemplate);
      const explicitIndex = Number(body.templateIndex);
      const hasExplicit = Number.isInteger(explicitIndex) && explicitIndex >= 0 && explicitIndex < festivalTemplates.length;
      const selected = hasExplicit
        ? { template: festivalTemplates[explicitIndex], nextIndex: explicitIndex }
        : pickNextTemplate(festivalTemplates, s.lastFestivalTemplateIndex);
      const festivalTpl = selected.template || s.festivalTemplate;
      const text = applyTemplate(festivalTpl, { festivalName });
      const sent = await sendToGoogleChat(text);
      if (!sent.ok) return res.status(502).json(sent);
      if (!hasExplicit) s.lastFestivalTemplateIndex = selected.nextIndex;
      await s.save();
      return res.json({ ok: true, sentCount: 1, usedTemplateIndex: selected.nextIndex });
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (e) {
    console.error('[announcement-trigger]', e);
    res.status(500).json({ error: 'Failed to trigger announcement' });
  }
});

app.get('/api/employees', authMiddleware, async (req, res) => {
  try {
    const authUser = await User.findById(req.auth.userId).lean();
    let query = Employee.find().sort({ createdAt: -1 });
    if (authUser && (authUser.app_role === 'employee' || authUser.app_role === 'freelancer_intern')) {
      if (!authUser.employeeId) return res.json([]);
      query = Employee.find({ _id: authUser.employeeId });
    }
    const list = await query.exec();
    res.json(list.map(serializeEmployee));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list employees' });
  }
});

app.get('/api/employees/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const authUser = await User.findById(req.auth.userId).lean();
    if (authUser && (authUser.app_role === 'employee' || authUser.app_role === 'freelancer_intern')) {
      const eid = authUser.employeeId ? authUser.employeeId.toString() : '';
      if (!eid || req.params.id !== eid) return res.status(403).json({ error: 'Forbidden' });
    }
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    res.json(serializeEmployee(emp));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/employees', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      email,
      password,
      fullName,
      app_role = 'employee',
      phone,
      type,
      department,
      jobTitle,
      reportingManagerId,
      joiningDate,
      dateOfBirth,
      salaryType,
      salaryAmount,
      bankName,
      accountNumber,
      accountHolderName,
      ifscCode,
      address,
      permanentAddress,
      nationality,
      passportNumber,
      bloodGroup,
      maritalStatus,
      aadhaarNumber,
      panNumber,
      pfNumber,
      uanNumber,
      emergencyContactName,
      emergencyContactRelation,
      emergencyContactPhone,
      previousCompany,
      previousSalary,
      status,
      requiresOnboarding,
    } = body;

    if (!email?.trim() || !fullName?.trim()) {
      return res.status(400).json({ error: 'Email and full name required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password min 6 characters required for new employee' });
    }

    const emailNorm = email.trim().toLowerCase();
    const exists = await User.findOne({ email: emailNorm });
    if (exists) return res.status(409).json({ error: 'User with this email already exists' });

    const emp = await Employee.create({
      fullName: fullName.trim(),
      email: emailNorm,
      phone: phone || '',
      type: type || 'Full Time',
      department: department || '',
      jobTitle: jobTitle || '',
      reportingManagerId: reportingManagerId || '',
      joiningDate: joiningDate || '',
      dateOfBirth: dateOfBirth || '',
      salaryType: salaryType || 'Fixed Monthly',
      salaryAmount: Number(salaryAmount) || 0,
      bankName: bankName || '',
      accountNumber: accountNumber || '',
      accountHolderName: accountHolderName || '',
      ifscCode: ifscCode || '',
      address: address || '',
      permanentAddress: permanentAddress || '',
      nationality: nationality || '',
      passportNumber: passportNumber || '',
      bloodGroup: bloodGroup || '',
      maritalStatus: maritalStatus || '',
      aadhaarNumber: aadhaarNumber || '',
      panNumber: panNumber || '',
      pfNumber: pfNumber || '',
      uanNumber: uanNumber || '',
      emergencyContactName: emergencyContactName || '',
      emergencyContactRelation: emergencyContactRelation || '',
      emergencyContactPhone: emergencyContactPhone || '',
      previousCompany: previousCompany || '',
      previousSalary: previousSalary || '',
      status: status || 'Active',
      // All new employee-role accounts require onboarding by default
      onboardingComplete: false,
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: emailNorm,
      passwordHash,
      fullName: fullName.trim(),
      app_role,
      employeeId: emp._id,
    });

    emp.userId = user._id;
    await emp.save();

    res.status(201).json(serializeEmployee(emp));
  } catch (e) {
    console.error(e);
    if (e.code === 11000) return res.status(409).json({ error: 'Duplicate email' });
    res.status(500).json({ error: e.message || 'Failed to create employee' });
  }
});

app.patch('/api/employees/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });

    const b = req.body || {};
    const fields = [
      'fullName',
      'email',
      'phone',
      'type',
      'department',
      'jobTitle',
      'reportingManagerId',
      'joiningDate',
      'dateOfBirth',
      'salaryType',
      'salaryAmount',
      'bankName',
      'accountNumber',
      'accountHolderName',
      'ifscCode',
      'address',
      'permanentAddress',
      'nationality',
      'passportNumber',
      'bloodGroup',
      'maritalStatus',
      'aadhaarNumber',
      'panNumber',
      'pfNumber',
      'uanNumber',
      'emergencyContactName',
      'emergencyContactRelation',
      'emergencyContactPhone',
      'previousCompany',
      'previousSalary',
      'status',
      'avatar',
      'onboardingComplete',
      'onboardingStep',
    ];
    for (const f of fields) {
      if (b[f] !== undefined) {
        if (f === 'salaryAmount') emp[f] = Number(b[f]) || 0;
        else if (f === 'email') emp[f] = String(b[f]).trim().toLowerCase();
        else emp[f] = b[f];
      }
    }

    await emp.save();

    if (emp.userId) {
      const user = await User.findById(emp.userId);
      if (user) {
        if (b.fullName !== undefined) user.fullName = String(b.fullName).trim();
        if (b.email !== undefined) user.email = String(b.email).trim().toLowerCase();
        if (b.password && String(b.password).length >= 6) {
          user.passwordHash = await bcrypt.hash(String(b.password), 10);
        }
        await user.save();
      }
    }

    res.json(serializeEmployee(emp));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// ── Onboarding Routes ──────────────────────────────────────────────────────────

app.get('/api/onboarding/me', authMiddleware, async (req, res) => {
  try {
    const authUser = await User.findById(req.auth.userId).lean();
    if (!authUser?.employeeId) return res.status(404).json({ error: 'No employee record linked' });
    const emp = await Employee.findById(authUser.employeeId);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(serializeEmployee(emp));
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/onboarding/me', authMiddleware, async (req, res) => {
  try {
    const authUser = await User.findById(req.auth.userId).lean();
    if (!authUser?.employeeId) return res.status(404).json({ error: 'No employee record linked' });
    const emp = await Employee.findById(authUser.employeeId);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const b = req.body || {};
    const allowedFields = [
      'fullName', 'phone', 'dateOfBirth', 'bloodGroup', 'maritalStatus', 'nationality',
      'address', 'permanentAddress',
      'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone',
      'aadhaarNumber', 'panNumber', 'pfNumber', 'uanNumber', 'passportNumber',
      'bankName', 'accountNumber', 'accountHolderName', 'ifscCode',
      'previousCompany', 'previousSalary',
      'onboardingStep', 'onboardingComplete',
    ];
    for (const f of allowedFields) {
      if (b[f] !== undefined) emp[f] = b[f];
    }

    if (b.onboardingComplete === true) {
      // Business rule: onboarding completion date is considered joining date.
      emp.joiningDate = formatYmd(new Date());
    }

    if (b.onboardingComplete === true && authUser.app_role !== 'super_admin' && authUser.app_role !== 'hr' && authUser.app_role !== 'hr_manager') {
      const user = await User.findById(authUser._id);
      if (user) {
        if (b.fullName) user.fullName = String(b.fullName).trim();
        await user.save();
      }
    }

    await emp.save();
    res.json(serializeEmployee(emp));
  } catch (e) {
    console.error('[onboarding put]', e);
    res.status(500).json({ error: 'Failed to save onboarding data' });
  }
});

app.post('/api/onboarding/documents', authMiddleware, async (req, res) => {
  try {
    const authUser = await User.findById(req.auth.userId).lean();
    if (!authUser?.employeeId) return res.status(404).json({ error: 'No employee record linked' });
    const emp = await Employee.findById(authUser.employeeId);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const { docType, label, fileName, mimeType, data } = req.body || {};
    if (!docType || !data) return res.status(400).json({ error: 'docType and data are required' });

    const existing = emp.onboardingDocuments.findIndex((d) => d.docType === docType);
    const docEntry = { docType, label: label || docType, fileName: fileName || '', mimeType: mimeType || '', data, uploadedAt: new Date() };
    if (existing >= 0) {
      emp.onboardingDocuments[existing] = docEntry;
    } else {
      emp.onboardingDocuments.push(docEntry);
    }
    await emp.save();

    const docs = emp.onboardingDocuments.map((d) => ({
      id: d._id?.toString(),
      docType: d.docType,
      label: d.label,
      fileName: d.fileName,
      mimeType: d.mimeType,
      uploadedAt: d.uploadedAt,
    }));
    res.json({ ok: true, documents: docs });
  } catch (e) {
    console.error('[onboarding docs]', e);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

app.get('/api/onboarding/documents', authMiddleware, async (req, res) => {
  try {
    const authUser = await User.findById(req.auth.userId).lean();
    let empId = authUser?.employeeId;
    if (authUser?.app_role === 'super_admin' || authUser?.app_role === 'hr' || authUser?.app_role === 'hr_manager') {
      if (req.query.employeeId) empId = req.query.employeeId;
    }
    if (!empId) return res.json([]);
    const emp = await Employee.findById(empId).select('onboardingDocuments').lean();
    if (!emp) return res.json([]);
    const docs = (emp.onboardingDocuments || []).map((d) => ({
      id: d._id?.toString(),
      docType: d.docType,
      label: d.label,
      fileName: d.fileName,
      mimeType: d.mimeType,
      uploadedAt: d.uploadedAt,
    }));
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/onboarding/documents/:docType/download', authMiddleware, async (req, res) => {
  try {
    const authUser = await User.findById(req.auth.userId).lean();
    let empId = authUser?.employeeId;
    if (authUser?.app_role === 'super_admin' || authUser?.app_role === 'hr' || authUser?.app_role === 'hr_manager') {
      if (req.query.employeeId) empId = req.query.employeeId;
    }
    if (!empId) return res.status(404).json({ error: 'Not found' });
    const emp = await Employee.findById(empId).select('onboardingDocuments').lean();
    if (!emp) return res.status(404).json({ error: 'Not found' });
    const doc = (emp.onboardingDocuments || []).find((d) => d.docType === req.params.docType);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json({ docType: doc.docType, fileName: doc.fileName, mimeType: doc.mimeType, data: doc.data });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── End Onboarding Routes ──────────────────────────────────────────────────────

registerDocumentAutomationRoutes(app, authMiddleware);
registerHrDataRoutes(app, authMiddleware);

function parseMongoConnectionInfo(uri) {
  try {
    const afterAt = uri.split('@')[1] || '';
    const slashIdx = afterAt.indexOf('/');
    const host = slashIdx === -1 ? afterAt : afterAt.slice(0, slashIdx);
    const pathPart = slashIdx === -1 ? '' : afterAt.slice(slashIdx + 1);
    const dbName = pathPart.split('?')[0] || '(default)';
    return { host, dbName };
  } catch {
    return { host: '(unknown)', dbName: '(unknown)' };
  }
}

function redactMongoUri(uri) {
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}

async function runAutoAnnouncements() {
  try {
    if (!GCHAT_WEBHOOK_URL) return;
    const s = await getOrCreateAnnouncementSettings();
    const today = formatYmd(new Date());
    const monthDay = formatMonthDay(new Date());

    if (s.autoBirthdayEnabled && s.lastBirthdayRunOn !== today) {
      const selected = pickNextTemplate(
        cleanTemplateList(s.birthdayTemplates, s.birthdayTemplate),
        s.lastBirthdayTemplateIndex
      );
      const birthdayTpl = selected.template || s.birthdayTemplate;
      const employees = await Employee.find({ status: 'Active' }).select('fullName dateOfBirth').lean();
      const todays = employees.filter((e) => {
        const p = parseDateParts(e.dateOfBirth);
        if (!p) return false;
        return `${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` === monthDay;
      });
      for (const emp of todays) {
        const text = applyTemplate(birthdayTpl, { name: emp.fullName });
        await sendToGoogleChat(text);
      }
      s.lastBirthdayRunOn = today;
      s.lastBirthdayTemplateIndex = selected.nextIndex;
    }

    if (
      s.autoFestivalEnabled &&
      s.festivalMonthDay &&
      s.festivalMonthDay === monthDay &&
      s.lastFestivalRunOn !== today
    ) {
      const selected = pickNextTemplate(
        cleanTemplateList(s.festivalTemplates, s.festivalTemplate),
        s.lastFestivalTemplateIndex
      );
      const festivalTpl = selected.template || s.festivalTemplate;
      const text = applyTemplate(festivalTpl, { festivalName: s.festivalName || 'Festival' });
      await sendToGoogleChat(text);
      s.lastFestivalRunOn = today;
      s.lastFestivalTemplateIndex = selected.nextIndex;
    }

    await s.save();
  } catch (e) {
    console.error('[auto-announcements]', e?.message || e);
  }
}

// ─── Festival Calendar ────────────────────────────────────────────────────────

function serializeFestival(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    name: o.name,
    monthDay: o.monthDay,
    emoji: o.emoji || '🎉',
    templateMessage: o.templateMessage || '',
    enabled: !!o.enabled,
    sortOrder: o.sortOrder ?? 0,
    createdAt: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
  };
}

async function callOpenAI(messages, schema = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const body = { model, temperature: 0.3, messages };
  if (schema) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return null;
  if (schema) { try { return JSON.parse(text); } catch { return null; } }
  return text;
}

// Regex fallback festival parser
function parseFestivalsFromText(text) {
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
  const results = [];
  const seen = new Set();

  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Pattern: "Festival Name - Jan 14" or "Jan 14 - Festival Name" or "Festival Name (January 14)"
    const m1 = line.match(/^(.+?)\s*[-–:]\s*([A-Za-z]+)\s+(\d{1,2})/);
    const m2 = line.match(/^([A-Za-z]+)\s+(\d{1,2})\s*[-–:]\s*(.+)/);
    const m3 = line.match(/^(.+?)\s*\(([A-Za-z]+)\s+(\d{1,2})\)/);

    let name = '', mon = '', day = '';
    if (m1) { name = m1[1].trim(); mon = m1[2].toLowerCase(); day = m1[3]; }
    else if (m2) { name = m3 ? m3[1].trim() : m2[3].trim(); mon = m2[1].toLowerCase(); day = m2[2]; }
    else if (m3) { name = m3[1].trim(); mon = m3[2].toLowerCase(); day = m3[3]; }

    const mNum = months[mon];
    if (!name || !mNum || !day) continue;
    const mm = String(mNum).padStart(2, '0');
    const dd = String(Number(day)).padStart(2, '0');
    const monthDay = `${mm}-${dd}`;
    const key = `${name.toLowerCase()}|${monthDay}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ name, monthDay });
  }
  return results;
}

// GET /api/festivals
app.get('/api/festivals', authMiddleware, async (req, res) => {
  try {
    const docs = await Festival.find().sort({ monthDay: 1, sortOrder: 1 }).lean();
    res.json(docs.map(d => serializeFestival({ toObject: () => d })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/festivals
app.post('/api/festivals', authMiddleware, async (req, res) => {
  try {
    const { name, monthDay, emoji, templateMessage, enabled } = req.body;
    if (!name || !monthDay) return res.status(400).json({ error: 'name and monthDay required' });
    const doc = await Festival.create({ name, monthDay, emoji: emoji || '🎉', templateMessage: templateMessage || '', enabled: !!enabled });
    res.json(serializeFestival(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/festivals/:id
app.put('/api/festivals/:id', authMiddleware, async (req, res) => {
  try {
    const fields = {};
    for (const k of ['name', 'monthDay', 'emoji', 'templateMessage', 'enabled', 'sortOrder']) {
      if (req.body[k] !== undefined) fields[k] = req.body[k];
    }
    const doc = await Festival.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(serializeFestival(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/festivals/:id
app.delete('/api/festivals/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await Festival.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/festivals/bulk-enable  { ids: [...], enabled: bool }
app.post('/api/festivals/bulk-enable', authMiddleware, async (req, res) => {
  try {
    const { ids, enabled } = req.body;
    if (ids === 'all') {
      await Festival.updateMany({}, { $set: { enabled: !!enabled } });
    } else if (Array.isArray(ids)) {
      await Festival.updateMany({ _id: { $in: ids } }, { $set: { enabled: !!enabled } });
    }
    const docs = await Festival.find().sort({ monthDay: 1 }).lean();
    res.json(docs.map(d => serializeFestival({ toObject: () => d })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/festivals/parse-from-text  { text: "..." }
app.post('/api/festivals/parse-from-text', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    // Try AI first
    const aiResult = await callOpenAI([
      {
        role: 'system',
        content: 'Extract festival/holiday names and dates from the given text. Return JSON: {"festivals":[{"name":"Diwali","monthDay":"10-20","emoji":"🪔"}]}. monthDay format: MM-DD. Include only entries that have a clearly identifiable date. If date has a year, strip the year. Emoji should match the festival vibe. Return empty array if none found.',
      },
      { role: 'user', content: text.slice(0, 8000) },
    ], true);

    let festivals = aiResult?.festivals;
    const source = festivals ? 'ai' : 'regex';

    if (!Array.isArray(festivals) || festivals.length === 0) {
      festivals = parseFestivalsFromText(text);
    }

    // Validate monthDay format
    const valid = (festivals || []).filter(f => f.name && /^\d{2}-\d{2}$/.test(f.monthDay));
    res.json({ festivals: valid, source });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/festivals/:id/suggest-template
app.post('/api/festivals/:id/suggest-template', authMiddleware, async (req, res) => {
  try {
    const doc = await Festival.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const aiMsg = await callOpenAI([
      {
        role: 'system',
        content: 'You are a corporate HR communication specialist. Write a warm, professional, concise Google Chat announcement message for a festival celebration. Max 2 sentences. Use the variable {festivalName} where the festival name should appear. Return only the message text, no quotes.',
      },
      { role: 'user', content: `Festival: ${doc.name} ${doc.emoji || '🎉'}` },
    ]);

    const fallback = `Wishing everyone a joyful ${doc.name}! ${doc.emoji || '🎉'} May this occasion bring happiness and togetherness to our entire team.`;

    res.json({ message: aiMsg ? aiMsg.trim() : fallback, source: aiMsg ? 'ai' : 'heuristic' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────

// ─── Simple Doc Templates (Mongoose, no Supabase) ───────────────────────────
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function serializeSimpleTemplate(doc, includeFile = false) {
  const o = doc.toObject ? doc.toObject() : doc;
  const base = {
    id: o._id.toString(),
    name: o.name,
    description: o.description || '',
    original_file_name: o.originalFileName || '',
    file_type: o.fileType || 'docx',
    fields: Array.isArray(o.fields) ? o.fields.map((f) => ({ fieldName: f.fieldName, placeholder: f.placeholder })) : [],
    created_at: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
  };
  if (includeFile && o.originalFileBase64) {
    base.original_file_url = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${o.originalFileBase64}`;
  }
  return base;
}

app.get('/api/doc-simple-templates', authMiddleware, async (req, res) => {
  try {
    const docs = await SimpleDocTemplate.find().sort({ createdAt: -1 }).lean();
    res.json(docs.map((d) => serializeSimpleTemplate({ toObject: () => d })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/doc-simple-templates/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await SimpleDocTemplate.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(serializeSimpleTemplate(doc, true));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/doc-simple-templates', authMiddleware, memUpload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const { templateName, description } = req.body;
    if (!templateName) return res.status(400).json({ error: 'templateName is required' });

    // Parse red-colored text fields from DOCX
    let fields = [];
    try {
      const { redSnippets } = analyzeDocxPlaceholders(file.buffer);
      fields = redSnippets.map((snippet) => ({
        fieldName: snippet.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
        placeholder: snippet,
      }));
    } catch {
      // parsing failure is non-fatal
    }

    const doc = await SimpleDocTemplate.create({
      name: templateName,
      description: description || '',
      originalFileName: file.originalname,
      fileType: 'docx',
      fields,
      originalFileBase64: file.buffer.toString('base64'),
      createdBy: req.auth?.userId || '',
    });

    res.json({
      message: `Template "${templateName}" uploaded successfully`,
      fieldsFound: fields.length,
      template: serializeSimpleTemplate(doc),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/doc-simple-templates/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await SimpleDocTemplate.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// ────────────────────────────────────────────────────────────────────────────

async function start() {
  const { host, dbName } = parseMongoConnectionInfo(MONGODB_URI);

  console.log('');
  console.log('========== HR API (MongoDB) ==========');
  console.log('[HR API] Starting server...');
  console.log('[HR API] MongoDB host (SRV target) =', host);
  console.log('[HR API] MongoDB database name       =', dbName);
  console.log('[HR API] MongoDB URI (redacted)      =', redactMongoUri(MONGODB_URI));
  console.log('[HR API] API port                    =', PORT);
  console.log('========================================');

  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    console.error('');
    console.error('[HR API] MongoDB connection FAILED');
    console.error('[HR API]', err.message);
    console.error('');
    console.error('[HR API] Atlas checklist:');
    console.error('  1. Network Access → add your current IP (or 0.0.0.0/0 for dev only)');
    console.error('  2. Database user + password correct (@ in password → use %40 in URI)');
    console.error('  3. Cluster is running (not paused)');
    console.error('');
    process.exit(1);
  }

  const conn = mongoose.connection;
  console.log('[HR API] MongoDB status              = connected ✓');
  console.log('[HR API] MongoDB readyState          =', conn.readyState, '(1 = connected)');
  console.log('[HR API] MongoDB active db           =', conn.db?.databaseName ?? dbName);

  app.listen(PORT, () => {
    console.log('[HR API] HTTP server                 = listening ✓');
    console.log('[HR API] Base URL                    = http://localhost:' + PORT);
    console.log('[HR API] Health check                = http://localhost:' + PORT + '/api/health');
    console.log('========================================');
    console.log('');
  });

  await runAutoAnnouncements();
  setInterval(() => {
    void runAutoAnnouncements();
  }, 60 * 60 * 1000);
}

start().catch((err) => {
  console.error('[HR API] Fatal:', err);
  process.exit(1);
});
