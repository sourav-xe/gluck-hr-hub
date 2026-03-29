import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import multer from 'multer';
import mammoth from 'mammoth';
import { User, Employee, DocumentTemplate, DocumentAutomationRun } from '../models.js';
import {
  DOC_AUTOMATION_ROOT,
  templateDir,
  templateOriginalPath,
  templateOriginalExtPath,
  templateWorkingPath,
  generatedRunDir,
  ensureDir,
  writeBuffer,
} from '../services/documentStorage.js';
import { mergeDocxTemplate } from '../services/docxMerge.js';
import {
  analyzeDocxPlaceholders,
  materializeRedSnippetsToMustache,
  replaceRedPlaceholderValuesInDocx,
} from '../services/docxRedAndMustache.js';
import { docxBufferToPdf } from '../services/docxToPdf.js';
import { suggestPlaceholdersWithAi } from '../services/aiPlaceholders.js';
import { defaultValuesFromEmployee } from '../services/employeePlaceholderDefaults.js';
import { buildSampleOfferLetterDocxBuffer } from '../buildSampleOfferLetterDocx.js';
import { analyzePdfPlaceholders, fillPdfTemplateWithPlaceholders } from '../services/pdfPlaceholders.js';

/**
 * 1) Replace literal red-run text with field values (same look, text swapped).
 * 2) Run docxtemplater for any {{mustache}} left in the DOCX (errors are non-fatal).
 */
function templateKindOf(t) {
  return t.templateKind === 'pdf' ? 'pdf' : 'docx';
}

async function mergeTemplateForExport(t, values) {
  if (templateKindOf(t) === 'pdf') {
    const pdfPath = templateOriginalExtPath(t.storageDir, 'pdf');
    const pdfBuf = await fs.readFile(pdfPath);
    let mergeError = '';
    let filled = pdfBuf;
    try {
      filled = await fillPdfTemplateWithPlaceholders(pdfBuf, values);
    } catch (e) {
      mergeError = e?.message || String(e);
      console.warn('[doc-automation] pdf fill:', mergeError);
    }
    return { buffer: filled, mergeError, outputKind: 'pdf' };
  }

  const filePath = t.mappingsCommitted ? templateWorkingPath(t.storageDir) : templateOriginalPath(t.storageDir);
  let buf = await fs.readFile(filePath);
  buf = replaceRedPlaceholderValuesInDocx(buf, t.placeholders || [], values);
  let mergeError = '';
  try {
    buf = mergeDocxTemplate(buf, values);
  } catch (e) {
    mergeError = e?.message || String(e);
    console.warn('[doc-automation] docxtemplater:', mergeError);
  }
  return { buffer: buf, mergeError, outputKind: 'docx' };
}

async function performGenerate(t, { values, employeeId, wantPdf, userId }) {
  const { buffer: merged, mergeError } = await mergeTemplateForExport(t, values);

  if (templateKindOf(t) === 'pdf') {
    const runId = new mongoose.Types.ObjectId().toString();
    const runDir = generatedRunDir(runId);
    await ensureDir(runDir);

    const pdfRel = path.join('generated', runId, 'output.pdf');
    const pdfAbs = path.join(DOC_AUTOMATION_ROOT, pdfRel);
    await writeBuffer(pdfAbs, merged);

    let employeeName = '';
    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      const emp = await Employee.findById(employeeId).lean();
      if (emp) employeeName = emp.fullName || '';
    }

    const run = await DocumentAutomationRun.create({
      templateId: t._id,
      templateName: t.name,
      employeeId,
      employeeName,
      values,
      docxRelativePath: '',
      pdfRelativePath: pdfRel,
      pdfError: mergeError || '',
      createdByUserId: String(userId || ''),
    });

    return {
      run: serializeRun(run),
      downloadDocxUrl: '',
      downloadPdfUrl: `/api/document-automation/runs/${run._id.toString()}/download?format=pdf`,
      pdfError: mergeError || undefined,
      mergeWarning: mergeError || undefined,
    };
  }

  const runId = new mongoose.Types.ObjectId().toString();
  const runDir = generatedRunDir(runId);
  await ensureDir(runDir);
  const docxRel = path.join('generated', runId, 'output.docx');
  const pdfRel = path.join('generated', runId, 'output.pdf');
  const docxAbs = path.join(DOC_AUTOMATION_ROOT, docxRel);
  await writeBuffer(docxAbs, merged);

  let pdfAbs = '';
  let pdfError = '';
  if (wantPdf) {
    try {
      const pdfBuf = await docxBufferToPdf(merged);
      pdfAbs = path.join(DOC_AUTOMATION_ROOT, pdfRel);
      await writeBuffer(pdfAbs, pdfBuf);
    } catch (pe) {
      pdfError = pe?.message || String(pe);
      console.warn('[doc-automation] PDF failed', pdfError);
    }
  }

  let employeeName = '';
  if (employeeId && mongoose.isValidObjectId(employeeId)) {
    const emp = await Employee.findById(employeeId).lean();
    if (emp) employeeName = emp.fullName || '';
  }

  const run = await DocumentAutomationRun.create({
    templateId: t._id,
    templateName: t.name,
    employeeId,
    employeeName,
    values,
    docxRelativePath: docxRel,
    pdfRelativePath: pdfAbs ? pdfRel : '',
    pdfError,
    createdByUserId: String(userId || ''),
  });

  return {
    run: serializeRun(run),
    downloadDocxUrl: `/api/document-automation/runs/${run._id.toString()}/download?format=docx`,
    downloadPdfUrl: pdfAbs ? `/api/document-automation/runs/${run._id.toString()}/download?format=pdf` : null,
    pdfError: pdfError || undefined,
    mergeWarning: mergeError || undefined,
  };
}

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

async function requireHrDocAutomation(req, res, next) {
  try {
    const u = await User.findById(req.auth.userId).lean();
    const r = normalizeRole(u?.app_role);
    if (!u || (r !== 'super_admin' && r !== 'hr_manager')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch {
    return res.status(500).json({ error: 'Auth failed' });
  }
}

function serializeTemplate(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    name: o.name,
    description: o.description || '',
    category: o.category || 'General',
    status: o.status,
    templateKind: o.templateKind || 'docx',
    placeholders: o.placeholders || [],
    mappingsCommitted: !!o.mappingsCommitted,
    originalFileName: o.originalFileName || '',
    lastDetectionAt: o.lastDetectionAt || undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function serializeRun(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    templateId: o.templateId ? String(o.templateId) : '',
    templateName: o.templateName,
    employeeId: o.employeeId || '',
    employeeName: o.employeeName || '',
    hasDocx: !!(o.docxRelativePath && String(o.docxRelativePath).trim()),
    hasPdf: !!(o.pdfRelativePath && String(o.pdfRelativePath).trim()),
    pdfError: o.pdfError || undefined,
    createdAt: o.createdAt,
  };
}

function prepareTemplateUpload(req, res, next) {
  req._templateStorageDir = new mongoose.Types.ObjectId().toString();
  next();
}

const uploadTemplate = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const dir = templateDir(req._templateStorageDir);
        await ensureDir(dir);
        cb(null, dir);
      } catch (e) {
        cb(e);
      }
    },
    filename: (_req, _file, cb) => {
      const name = String(_file.originalname || '').toLowerCase();
      const isPdf = name.endsWith('.pdf') || String(_file.mimetype || '').toLowerCase().includes('pdf');
      cb(null, isPdf ? 'original.pdf' : 'original.docx');
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx') ||
      file.mimetype === 'application/pdf' ||
      name.endsWith('.pdf');
    cb(null, ok);
  },
});

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authMiddleware
 */
export function registerDocumentAutomationRoutes(app, authMiddleware) {
  app.get('/api/document-automation/templates', authMiddleware, requireHrDocAutomation, async (_req, res) => {
    try {
      const list = await DocumentTemplate.find().sort({ updatedAt: -1 }).limit(500).exec();
      res.json(list.map(serializeTemplate));
    } catch (e) {
      console.error('[doc-automation] list templates', e);
      res.status(500).json({ error: 'Failed to list templates' });
    }
  });

  app.post(
    '/api/document-automation/templates',
    authMiddleware,
    requireHrDocAutomation,
    prepareTemplateUpload,
    uploadTemplate.single('file'),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'Template file required (field name: file)' });
        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ error: 'name is required' });
        const description = String(req.body?.description || '').trim();
        const category = String(req.body?.category || 'General').trim();
        const status = req.body?.status === 'active' ? 'active' : 'draft';

        const storageDir = req._templateStorageDir;
        const fileNameLower = String(req.file.originalname || '').toLowerCase();
        const isPdf = fileNameLower.endsWith('.pdf') || String(req.file.mimetype || '').toLowerCase().includes('pdf');
        const templateKind = isPdf ? 'pdf' : 'docx';

        if (templateKind === 'docx') {
          const original = templateOriginalPath(storageDir);
          const working = templateWorkingPath(storageDir);
          await fs.copyFile(original, working);
        }

        const me = await User.findById(req.auth.userId).lean();
        const created = await DocumentTemplate.create({
          name,
          description,
          category,
          status,
          templateKind,
          storageDir,
          originalFileName: req.file.originalname || (templateKind === 'pdf' ? 'template.pdf' : 'template.docx'),
          placeholders: [],
          mappingsCommitted: false,
          createdByUserId: me?._id ? String(me._id) : '',
        });

        res.status(201).json(serializeTemplate(created));
      } catch (e) {
        console.error('[doc-automation] create template', e);
        res.status(500).json({ error: e.message || 'Failed to create template' });
      }
    }
  );

  app.get('/api/document-automation/templates/:id', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const t = await DocumentTemplate.findById(req.params.id);
      if (!t) return res.status(404).json({ error: 'Not found' });
      res.json(serializeTemplate(t));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.patch('/api/document-automation/templates/:id', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const t = await DocumentTemplate.findById(req.params.id);
      if (!t) return res.status(404).json({ error: 'Not found' });

      const body = req.body || {};
      if (body.name !== undefined) t.name = String(body.name).trim() || t.name;
      if (body.description !== undefined) t.description = String(body.description || '');
      if (body.category !== undefined) t.category = String(body.category || 'General');
      if (body.status === 'draft' || body.status === 'active') t.status = body.status;

      if (Array.isArray(body.placeholders)) {
        t.placeholders = body.placeholders.map((p) => ({
          key: String(p.key || '').trim(),
          label: String(p.label || '').trim(),
          source: ['mustache', 'red', 'ai', 'manual', 'heuristic'].includes(p.source) ? p.source : 'manual',
          exampleValue: String(p.exampleValue || ''),
          redSnippet: String(p.redSnippet || ''),
        })).filter((p) => p.key);
      }

      if (body.commitMappings === true) {
        if (templateKindOf(t) === 'pdf') {
          // For PDF templates we use `{{key}}` markers directly; no working DOCX rewrite needed.
          t.mappingsCommitted = true;
        } else {
          const mappings = (t.placeholders || [])
            .filter((p) => p.redSnippet && String(p.redSnippet).trim())
            .map((p) => ({ key: p.key, redSnippet: String(p.redSnippet).trim() }));
          if (mappings.length > 0) {
            const originalBuf = await fs.readFile(templateOriginalPath(t.storageDir));
            const out = materializeRedSnippetsToMustache(originalBuf, mappings);
            await writeBuffer(templateWorkingPath(t.storageDir), out);
          }
          t.mappingsCommitted = true;
        }
      }

      await t.save();
      res.json(serializeTemplate(t));
    } catch (e) {
      console.error('[doc-automation] patch template', e);
      res.status(500).json({ error: e.message || 'Failed to update template' });
    }
  });

  app.delete('/api/document-automation/templates/:id', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const t = await DocumentTemplate.findById(req.params.id);
      if (!t) return res.status(404).json({ error: 'Not found' });
      const dir = templateDir(t.storageDir);
      await fs.rm(dir, { recursive: true, force: true });
      await DocumentTemplate.deleteOne({ _id: t._id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete' });
    }
  });

  app.post('/api/document-automation/templates/:id/detect', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const t = await DocumentTemplate.findById(req.params.id);
      if (!t) return res.status(404).json({ error: 'Not found' });
      const useAi = !!(req.body && req.body.useAi);

      if (templateKindOf(t) === 'pdf') {
        const pdfPath = templateOriginalExtPath(t.storageDir, 'pdf');
        if (!fsSync.existsSync(pdfPath)) {
          return res.status(400).json({ error: 'PDF template file missing on disk' });
        }
        const pdfBuf = await fs.readFile(pdfPath);
        const { suggestions, mustacheKeys, redSnippets } = await analyzePdfPlaceholders(pdfBuf);
        t.lastDetectionAt = new Date();
        await t.save();
        return res.json({
          suggestions,
          mustacheKeys,
          redSnippets,
          aiEnabled: false,
        });
      }

      const originalBuf = await fs.readFile(templateOriginalPath(t.storageDir));
      const { mustacheKeys, redSnippets } = analyzeDocxPlaceholders(originalBuf);

      const aiOrHeuristic = await suggestPlaceholdersWithAi(redSnippets);
      const fromRed = redSnippets.map((snippet, i) => {
        const row = aiOrHeuristic[i] || {};
        const src = row.source === 'ai' ? 'ai' : 'red';
        return {
          key: row.key || `field_${i + 1}`,
          label: row.label || row.key || snippet.slice(0, 80),
          source: src,
          exampleValue: String(row.exampleValue || snippet || ''),
          redSnippet: snippet,
        };
      });

      const fromMustache = mustacheKeys.map((key) => ({
        key,
        label: key.replace(/_/g, ' '),
        source: 'mustache',
        exampleValue: '',
        redSnippet: '',
      }));

      const merged = [...fromMustache];
      const keys = new Set(merged.map((m) => m.key));
      for (const row of fromRed) {
        if (!keys.has(row.key)) {
          keys.add(row.key);
          merged.push(row);
        }
      }

      t.lastDetectionAt = new Date();
      await t.save();

      res.json({
        suggestions: merged,
        mustacheKeys,
        redSnippets,
        aiEnabled: !!process.env.OPENAI_API_KEY,
      });
    } catch (e) {
      console.error('[doc-automation] detect', e);
      res.status(500).json({ error: e.message || 'Detection failed' });
    }
  });

  app.post('/api/document-automation/templates/:id/preview', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const t = await DocumentTemplate.findById(req.params.id);
      if (!t) return res.status(404).json({ error: 'Not found' });
      const values = (req.body && req.body.values) || {};

      const { buffer: merged, mergeError } = await mergeTemplateForExport(t, values);
      if (templateKindOf(t) === 'pdf') {
        const pdfBase64 = Buffer.from(merged).toString('base64');
        res.json({ pdfBase64, values, mergeWarning: mergeError || undefined });
        return;
      }

      const { value: html } = await mammoth.convertToHtml({ buffer: merged });

      res.json({ html, values, mergeWarning: mergeError || undefined });
    } catch (e) {
      console.error('[doc-automation] preview', e);
      res.status(500).json({ error: e.message || 'Preview failed' });
    }
  });

  app.post('/api/document-automation/templates/:id/generate', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const t = await DocumentTemplate.findById(req.params.id);
      if (!t) return res.status(404).json({ error: 'Not found' });

      const body = req.body || {};
      const values = body.values && typeof body.values === 'object' ? body.values : {};
      const employeeId = body.employeeId ? String(body.employeeId) : '';
      const wantPdf = body.outputPdf !== false;

      const payload = await performGenerate(t, {
        values,
        employeeId,
        wantPdf,
        userId: req.auth.userId,
      });
      res.status(201).json(payload);
    } catch (e) {
      console.error('[doc-automation] generate', e);
      res.status(500).json({ error: e.message || 'Generate failed' });
    }
  });

  app.post('/api/document-automation/templates/:id/generate-batch', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const t = await DocumentTemplate.findById(req.params.id);
      if (!t) return res.status(404).json({ error: 'Not found' });
      if (t.status !== 'active') {
        return res.status(400).json({ error: 'Template must be active. Finish step 2 (Generate template) first.' });
      }

      const body = req.body || {};
      const rows = body.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'rows must be a non-empty array of objects (CSV headers = keys)' });
      }
      if (rows.length > 500) return res.status(400).json({ error: 'Maximum 500 rows per batch' });

      const employeeId = body.employeeId ? String(body.employeeId) : '';
      const wantPdf = body.outputPdf !== false;

      const results = [];
      const errors = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          errors.push({ index: i, error: 'Invalid row' });
          continue;
        }
        try {
          const values = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [String(k), v === undefined || v === null ? '' : String(v)])
          );
          const payload = await performGenerate(t, {
            values,
            employeeId,
            wantPdf,
            userId: req.auth.userId,
          });
          results.push({ index: i, ...payload });
        } catch (err) {
          errors.push({ index: i, error: err?.message || String(err) });
        }
      }

      res.json({
        ok: true,
        generated: results.length,
        results,
        errors,
      });
    } catch (e) {
      console.error('[doc-automation] generate-batch', e);
      res.status(500).json({ error: e.message || 'Batch generate failed' });
    }
  });

  app.get('/api/document-automation/runs', authMiddleware, requireHrDocAutomation, async (_req, res) => {
    try {
      const list = await DocumentAutomationRun.find().sort({ createdAt: -1 }).limit(200).exec();
      res.json(list.map(serializeRun));
    } catch (e) {
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  app.get('/api/document-automation/runs/:id/download', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const run = await DocumentAutomationRun.findById(req.params.id);
      if (!run) return res.status(404).json({ error: 'Not found' });
      const format = String(req.query.format || 'docx').toLowerCase();
      const rel = format === 'pdf' ? run.pdfRelativePath : run.docxRelativePath;
      if (!rel || !String(rel).trim()) return res.status(404).json({ error: 'File not available' });
      const abs = path.join(DOC_AUTOMATION_ROOT, rel);
      if (!fsSync.existsSync(abs)) return res.status(404).json({ error: 'Missing on disk' });

      const mime =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const nameSafe = `${(run.templateName || 'document').replace(/[^a-z0-9-_]+/gi, '_')}_${run._id.toString().slice(-6)}.${format === 'pdf' ? 'pdf' : 'docx'}`;
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="${nameSafe}"`);
      fsSync.createReadStream(abs).pipe(res);
    } catch (e) {
      res.status(500).json({ error: 'Download failed' });
    }
  });

  app.get('/api/document-automation/employee-defaults/:employeeId', authMiddleware, requireHrDocAutomation, async (req, res) => {
    try {
      const id = req.params.employeeId;
      if (!mongoose.isValidObjectId(id) || id === 'none') {
        return res.json({ values: {} });
      }
      const emp = await Employee.findById(id).lean();
      if (!emp) return res.status(404).json({ error: 'Employee not found' });

      let mgrName = '';
      const mid = emp.reportingManagerId;
      if (mid && mongoose.isValidObjectId(mid)) {
        const mgr = await Employee.findById(mid).lean();
        if (mgr) mgrName = mgr.fullName || '';
      }

      res.json({ values: defaultValuesFromEmployee(emp, mgrName) });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });
}

/**
 * Idempotent seed: creates sample offer letter template on disk + DB if none with same name.
 */
export async function ensureSampleDocumentTemplates(adminUserId) {
  await ensureDir(DOC_AUTOMATION_ROOT);
  const existing = await DocumentTemplate.findOne({ name: 'Sample Offer Letter (Gluck)' }).lean();
  if (existing) return { created: false, id: String(existing._id) };

  const storageDir = new mongoose.Types.ObjectId().toString();
  const dir = templateDir(storageDir);
  await ensureDir(dir);
  const docxBuf = await buildSampleOfferLetterDocxBuffer();
  await writeBuffer(templateOriginalPath(storageDir), docxBuf);
  await writeBuffer(templateWorkingPath(storageDir), docxBuf);

  const placeholders = [
    { key: 'letter_date', label: 'Letter date', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'employee_full_name', label: 'Employee full name', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'job_title', label: 'Job title', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'department', label: 'Department', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'joining_date', label: 'Joining date', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'reporting_manager', label: 'Reporting manager', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'salary_formatted', label: 'Salary (formatted)', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'salary_type', label: 'Salary type', source: 'mustache', exampleValue: '', redSnippet: '' },
    { key: 'employee_address', label: 'Employee address', source: 'mustache', exampleValue: '', redSnippet: '' },
  ];

  const created = await DocumentTemplate.create({
    name: 'Sample Offer Letter (Gluck)',
    description: 'Ready-to-test DOCX with red {{placeholders}}. Duplicate keys detected from mustache.',
    category: 'Offer',
    status: 'active',
    templateKind: 'docx',
    storageDir,
    originalFileName: 'sample-offer-letter.docx',
    placeholders,
    mappingsCommitted: true,
    createdByUserId: adminUserId ? String(adminUserId) : '',
  });

  return { created: true, id: created._id.toString() };
}
