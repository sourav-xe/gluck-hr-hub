import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  fetchAnnouncementSettings, putAnnouncementSettings, triggerAnnouncement,
  fetchFestivals, createFestival, updateFestival, deleteFestival,
  bulkEnableFestivals, parseFestivalsFromText, suggestFestivalTemplate,
  fetchEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  sendEmail, fetchEmailConfigStatus,   verifyEmailConnection,
  type FestivalRow, type EmailTemplate,
} from '@/lib/hrApi';
import { fileFromEmailDraftStash, readEmailDraftStashMeta } from '@/lib/emailDraftStash';
import {
  Send, Plus, Trash2, Pencil, Check, X, MoreVertical,
  UserRound, PartyPopper, ArrowRight, Cake, Sparkles, Save,
  Upload, FileText, Loader2, Wand2, ToggleLeft, ToggleRight, CalendarDays,
  Mail, Paperclip, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ── helpers ─────────────────────────────────────────────────────────────────── */

function monthDayToInputDate(md: string): string {
  if (!md || !/^\d{2}-\d{2}$/.test(md)) return '';
  return `${new Date().getFullYear()}-${md}`;
}
function inputDateToMonthDay(v: string): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  return v.slice(5);
}
function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface HistoryItem { id: number; label: string; sub: string; ts: number; kind: 'manual' | 'birthday' | 'festival' }

function detectEmailTemplateVars(body: string, subject: string): string[] {
  const m = [...(`${body || ''} ${subject || ''}`).matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(m.map((x) => x[1]))];
}

function humanizeTemplateVarKey(v: string) {
  return v.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
}

type EmailSendReceipt = {
  sentAt: number;
  from: string;
  to: string;
  templateName: string;
  subject: string;
  body: string;
  variables: Record<string, string>;
  attachmentNames: string[];
  serverMessage?: string;
};

/* ── main component ──────────────────────────────────────────────────────────── */

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'manual' | 'templates' | 'festivals' | 'email'>('manual');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  /* manual */
  const [manualText, setManualText] = useState('');
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayTplIdx, setBirthdayTplIdx] = useState('auto');
  const [festivalTplIdx, setFestivalTplIdx] = useState('auto');

  /* settings */
  const [settings, setSettings] = useState({
    birthdayTemplates: ['Happy Birthday {name}! 🎂 Wishing you a wonderful year ahead from the Gluck Global family.'],
    festivalTemplates: ['Happy {festivalName}! ✨ Wishing everyone joy, health, and success.'],
    birthdayTemplate: '',
    festivalTemplate: '',
    festivalName: '',
    festivalMonthDay: '',
    autoBirthdayEnabled: true,
    autoFestivalEnabled: false,
    lastBirthdayRunOn: '',
    lastFestivalRunOn: '',
  });
  const originalSettings = useRef(settings);

  /* template names (display-only, session-scoped) */
  const [bdayNames, setBdayNames] = useState<string[]>(['Standard Birthday Wish']);
  const [festNames, setFestNames] = useState<string[]>(['Global Festive Greeting']);

  /* inline editing in templates tab */
  const [editingBday, setEditingBday] = useState<number | null>(null);
  const [editingFest, setEditingFest] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState({ name: '', msg: '' });

  /* ── email state ─────────────────────────────────────────────────────────── */
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [emailFrom, setEmailFrom] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailVars, setEmailVars] = useState<Record<string, string>>({});
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddEmailTpl, setShowAddEmailTpl] = useState(false);
  const [newEmailTpl, setNewEmailTpl] = useState({ name: '', subject: '', body: '', category: 'General' });
  const [editingEmailTplId, setEditingEmailTplId] = useState<string | null>(null);
  const [editEmailTplBuf, setEditEmailTplBuf] = useState({ name: '', subject: '', body: '', category: '' });
  const [emailSavingTpl, setEmailSavingTpl] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message?: string; error?: string; hint?: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const emailAttachRef = useRef<HTMLInputElement>(null);
  const [emailDraftMeta, setEmailDraftMeta] = useState<{ fileName: string; savedAt: number } | null>(null);
  const [emailSendReceipt, setEmailSendReceipt] = useState<EmailSendReceipt | null>(null);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [parsedPdfSegments, setParsedPdfSegments] = useState<Array<{text: string; isRed: boolean}> | null>(null);
  const [pdfFieldNames, setPdfFieldNames] = useState<string[]>([]);
  const [pdfTplName, setPdfTplName] = useState('');
  const [pdfTplSubject, setPdfTplSubject] = useState('');
  const [pdfSaving, setPdfSaving] = useState(false);
  const pdfImportFileRef = useRef<HTMLInputElement>(null);

  const selectedEmailTemplate = emailTemplates.find((t) => t.id === selectedTemplateId) ?? null;

  /* ── festival state ──────────────────────────────────────────────────────── */
  const [festivals, setFestivals] = useState<FestivalRow[]>([]);
  const [festivalsLoading, setFestivalsLoading] = useState(false);
  const [festPdfParsing, setFestPdfParsing] = useState(false);
  const [festParsedPreview, setFestParsedPreview] = useState<{ name: string; monthDay: string; emoji: string }[] | null>(null);
  const [festPdfSource, setFestPdfSource] = useState('');
  const [festImporting, setFestImporting] = useState(false);
  const [editingFestId, setEditingFestId] = useState<string | null>(null);
  const [editingFestBuf, setEditingFestBuf] = useState({ name: '', monthDay: '', emoji: '', templateMessage: '' });
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [bulkEnabling, setBulkEnabling] = useState(false);
  const festFileRef = useRef<HTMLInputElement>(null);

  const loadFestivals = useCallback(async () => {
    setFestivalsLoading(true);
    const list = await fetchFestivals();
    setFestivals(list);
    setFestivalsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'festivals' && festivals.length === 0 && !festivalsLoading) {
      void loadFestivals();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'email' && emailTemplates.length === 0 && !emailTemplatesLoading) {
      void loadEmailTemplates();
    }
    if (tab === 'email' && emailConfigured === null) {
      void (async () => {
        const cfg = await fetchEmailConfigStatus();
        setEmailConfigured(cfg.configured);
        setEmailFrom(cfg.emailFrom);
      })();
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== 'email') return;
    const sync = () => setEmailDraftMeta(readEmailDraftStashMeta());
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, [tab]);

  /* ── email helpers ────────────────────────────────────────────────────────── */
  async function loadEmailTemplates() {
    setEmailTemplatesLoading(true);
    const list = await fetchEmailTemplates();
    setEmailTemplates(list);
    if (list.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(list[0].id);
      const vars: Record<string, string> = {};
      for (const v of list[0].variables) vars[v] = '';
      setEmailVars(vars);
    }
    setEmailTemplatesLoading(false);
  }

  function onSelectEmailTemplate(id: string) {
    setSelectedTemplateId(id);
    const tpl = emailTemplates.find((t) => t.id === id);
    if (tpl) {
      const vars: Record<string, string> = {};
      for (const v of tpl.variables) vars[v] = '';
      setEmailVars(vars);
    }
    setShowPreview(false);
  }

  async function handleSendEmail() {
    if (!emailTo.trim() || !selectedTemplateId || !selectedEmailTemplate) return;
    const tpl = selectedEmailTemplate;
    const toAddr = emailTo.trim();
    const varsSnapshot = { ...emailVars };
    const attachmentNames = emailAttachments.map((f) => f.name);
    setEmailSending(true);
    try {
      const result = await sendEmail({ to: toAddr, templateId: selectedTemplateId, variables: emailVars, attachments: emailAttachments });
      if (!result.ok) {
        toast({ title: 'Send failed', description: result.error, variant: 'destructive' });
      } else {
        setEmailSendReceipt({
          sentAt: Date.now(),
          from: emailFrom?.trim() || '—',
          to: toAddr,
          templateName: tpl.name,
          subject: tpl.subject,
          body: tpl.body,
          variables: varsSnapshot,
          attachmentNames,
          serverMessage: result.message,
        });
        toast({ title: 'Email sent', description: 'Review the confirmation details below.' });
        setEmailTo('');
        setEmailAttachments([]);
        const vars: Record<string, string> = {};
        for (const v of tpl.variables) vars[v] = '';
        setEmailVars(vars);
        setShowPreview(false);
        pushHistory({ label: `Email sent to ${toAddr}`, sub: `Template: ${tpl.name}`, ts: Date.now(), kind: 'manual' });
      }
    } finally {
      setEmailSending(false);
    }
  }

  async function handleSaveNewEmailTpl() {
    if (!newEmailTpl.name.trim() || !newEmailTpl.subject.trim() || !newEmailTpl.body.trim()) return;
    setEmailSavingTpl(true);
    const created = await createEmailTemplate(newEmailTpl);
    if (created) {
      setEmailTemplates((p) => [created, ...p]);
      onSelectEmailTemplate(created.id);
      setNewEmailTpl({ name: '', subject: '', body: '', category: 'General' });
      setShowAddEmailTpl(false);
      toast({ title: 'Template created' });
    } else {
      toast({ title: 'Failed to create template', variant: 'destructive' });
    }
    setEmailSavingTpl(false);
  }

  async function handleUpdateEmailTpl() {
    if (!editingEmailTplId) return;
    if (!editEmailTplBuf.name.trim() || !editEmailTplBuf.subject.trim() || !editEmailTplBuf.body.trim()) {
      toast({ title: 'Missing fields', description: 'Name, subject, and body are required.', variant: 'destructive' });
      return;
    }
    const id = editingEmailTplId;
    setEmailSavingTpl(true);
    const result = await updateEmailTemplate(id, editEmailTplBuf);
    if (result.ok) {
      setEmailTemplates((p) => p.map((t) => t.id === id ? result.template : t));
      setEditingEmailTplId(null);
      toast({ title: 'Template saved', description: result.template.name });
      if (selectedTemplateId === id) onSelectEmailTemplate(result.template.id);
    } else {
      toast({ title: 'Could not save template', description: result.error, variant: 'destructive' });
    }
    setEmailSavingTpl(false);
  }

  async function handleDeleteEmailTpl(id: string) {
    const ok = await deleteEmailTemplate(id);
    if (ok) {
      setEmailTemplates((p) => p.filter((t) => t.id !== id));
      if (selectedTemplateId === id) {
        const remaining = emailTemplates.filter((t) => t.id !== id);
        if (remaining.length > 0) onSelectEmailTemplate(remaining[0].id);
        else setSelectedTemplateId('');
      }
      toast({ title: 'Template deleted' });
    }
  }

  async function handleVerifyEmail() {
    setVerifyingEmail(true);
    setVerifyResult(null);
    const result = await verifyEmailConnection();
    setVerifyResult(result);
    if (result.ok) {
      setEmailConfigured(true);
      toast({ title: 'Connection verified!', description: result.message });
    }
    setVerifyingEmail(false);
  }

  function extractGlyphText(glyph: unknown): string {
    if (!glyph) return '';
    if (typeof glyph === 'string') return glyph;
    const g = glyph as Record<string, unknown>;
    if (typeof g.unicode === 'string') return g.unicode;
    if (typeof g.chars === 'string') return g.chars;
    if (typeof g.fontChar === 'string') return g.fontChar;
    return '';
  }

  async function handlePdfTemplateUpload(file: File) {
    setPdfParsing(true);
    setParsedPdfSegments(null);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const { OPS } = pdfjsLib;
      const segments: Array<{text: string; isRed: boolean}> = [];

      const addText = (text: string, isRed: boolean) => {
        if (!text) return;
        const last = segments[segments.length - 1];
        if (last && last.isRed === isRed) { last.text += text; }
        else segments.push({ text, isRed });
      };

      const addNewline = () => {
        const last = segments[segments.length - 1];
        if (last?.text.endsWith('\n')) return;
        if (last && !last.isRed) { last.text += '\n'; }
        else segments.push({ text: '\n', isRed: false });
      };

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (pageNum > 1) addNewline();
        const page = await pdf.getPage(pageNum);
        const opList = await page.getOperatorList();
        let fr = 0, fg = 0, fb = 0;
        let lastY: number | null = null;

        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i] as unknown[];

          if (fn === OPS.setFillRGBColor) { fr = args[0] as number; fg = args[1] as number; fb = args[2] as number; }
          else if (fn === OPS.setFillGray) { fr = fg = fb = args[0] as number; }
          else if (fn === OPS.setFillCMYKColor) {
            const [c, m, y, k] = args as number[];
            fr = (1 - c) * (1 - k); fg = (1 - m) * (1 - k); fb = (1 - y) * (1 - k);
          }
          else if (fn === OPS.setTextMatrix) {
            const newY = args[5] as number;
            if (lastY !== null && Math.abs(newY - lastY) > 1) addNewline();
            lastY = newY;
          }
          else if (fn === OPS.moveText || fn === OPS.setLeadingMoveText) {
            if ((args[1] as number) !== 0) addNewline();
          }
          else if (fn === OPS.nextLine) { addNewline(); }
          else {
            const isShow = fn === OPS.showText || fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText;
            const isSpaced = fn === OPS.showSpacedText;
            if (isShow || isSpaced) {
              if (fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) addNewline();
              const glyphs = args[0] as unknown[];
              let text = '';
              if (isSpaced) {
                for (const item of glyphs) {
                  if (typeof item === 'number') { if (item < -80) text += ' '; }
                  else if (item !== null && item !== undefined) text += extractGlyphText(item);
                }
              } else {
                for (const glyph of glyphs) {
                  if (glyph === null) text += ' ';
                  else text += extractGlyphText(glyph);
                }
              }
              if (text) {
                const isRed = fr > 0.5 && fg < 0.4 && fb < 0.4;
                addText(text, isRed);
              }
            }
          }
        }
      }

      const filtered = segments.filter((s) => s.text.trim() || s.text.includes('\n'));
      let redCount = 0;
      const fieldNamesArr: string[] = [];
      for (const seg of filtered) { if (seg.isRed) fieldNamesArr.push(`field${++redCount}`); }

      if (filtered.length === 0) {
        toast({ title: 'No text detected', description: 'Could not extract text from this PDF. Make sure it contains selectable text (not scanned image).', variant: 'destructive' });
        return;
      }
      if (fieldNamesArr.length === 0) {
        toast({ title: 'No red text found', description: 'No red-colored text was detected. Make sure your template uses red color for dynamic fields.', variant: 'destructive' });
      }

      setParsedPdfSegments(filtered);
      setPdfFieldNames(fieldNamesArr);
      setPdfTplName(file.name.replace(/\.pdf$/i, ''));
      setPdfTplSubject('');
    } catch (e: unknown) {
      toast({ title: 'PDF parsing failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setPdfParsing(false);
    }
  }

  async function handleSavePdfTemplate() {
    if (!pdfTplName.trim() || !pdfTplSubject.trim() || !parsedPdfSegments) return;
    setPdfSaving(true);
    let body = '';
    let redIdx = 0;
    for (const seg of parsedPdfSegments) {
      if (seg.isRed) {
        const name = pdfFieldNames[redIdx]?.trim().replace(/\s+/g, '_') || `field${redIdx + 1}`;
        body += `{{${name}}}`;
        redIdx++;
      } else {
        body += seg.text;
      }
    }
    const created = await createEmailTemplate({ name: pdfTplName.trim(), subject: pdfTplSubject.trim(), body: body.trim(), category: 'PDF Import' });
    if (created) {
      setEmailTemplates((p) => [created, ...p]);
      setParsedPdfSegments(null);
      setPdfFieldNames([]);
      setShowPdfImport(false);
      setShowAddEmailTpl(false);
      toast({ title: 'Template created from PDF!' });
      onSelectEmailTemplate(created.id);
    } else {
      toast({ title: 'Failed to save template', variant: 'destructive' });
    }
    setPdfSaving(false);
  }

  /* ── history (session-only) ──────────────────────────────────────────────── */
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyIdRef = useRef(0);

  function pushHistory(item: Omit<HistoryItem, 'id'>) {
    setHistory((h) => [{ ...item, id: ++historyIdRef.current }, ...h].slice(0, 20));
  }

  /* ── load settings ────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchAnnouncementSettings();
        if (!cancelled) {
          const next = {
            ...s,
            birthdayTemplates: s.birthdayTemplates?.length ? s.birthdayTemplates : [s.birthdayTemplate],
            festivalTemplates: s.festivalTemplates?.length ? s.festivalTemplates : [s.festivalTemplate],
          };
          setSettings((p) => ({ ...p, ...next }));
          originalSettings.current = { ...settings, ...next };
          /* seed display names */
          setBdayNames((prev) => {
            const arr = next.birthdayTemplates.map((_, i) => prev[i] ?? `Template #${i + 1}`);
            return arr;
          });
          setFestNames((prev) => {
            const arr = next.festivalTemplates.map((_, i) => prev[i] ?? `Template #${i + 1}`);
            return arr;
          });
        }
      } catch {
        if (!cancelled) toast({ title: 'Failed to load settings', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── save ──────────────────────────────────────────────────────────────────── */
  async function saveTemplates() {
    setSaving(true);
    try {
      const saved = await putAnnouncementSettings({
        birthdayTemplates: settings.birthdayTemplates,
        festivalTemplates: settings.festivalTemplates,
        birthdayTemplate: settings.birthdayTemplates[0] || '',
        festivalTemplate: settings.festivalTemplates[0] || '',
        festivalName: settings.festivalName,
        festivalMonthDay: settings.festivalMonthDay,
        autoBirthdayEnabled: settings.autoBirthdayEnabled,
        autoFestivalEnabled: settings.autoFestivalEnabled,
      });
      setSettings((p) => ({
        ...p, ...saved,
        birthdayTemplates: saved.birthdayTemplates?.length ? saved.birthdayTemplates : p.birthdayTemplates,
        festivalTemplates: saved.festivalTemplates?.length ? saved.festivalTemplates : p.festivalTemplates,
      }));
      originalSettings.current = settings;
      toast({ title: 'Saved', description: 'Announcement templates saved successfully.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setSettings(originalSettings.current);
  }

  /* ── trigger ───────────────────────────────────────────────────────────────── */
  async function trigger(mode: 'manual' | 'birthday' | 'festival') {
    setSending(true);
    try {
      const payload =
        mode === 'manual'
          ? { mode, message: manualText }
          : mode === 'birthday'
          ? { mode, name: birthdayName, templateIndex: birthdayTplIdx === 'auto' ? undefined : Number(birthdayTplIdx) }
          : { mode, festivalName: settings.festivalName, templateIndex: festivalTplIdx === 'auto' ? undefined : Number(festivalTplIdx) };
      const r = await triggerAnnouncement(payload);
      if (!r.ok) {
        toast({ title: 'Send failed', description: r.error, variant: 'destructive' });
        return;
      }
      const usedName = mode === 'birthday'
        ? bdayNames[r.usedTemplateIndex ?? 0] ?? `Template #${(r.usedTemplateIndex ?? 0) + 1}`
        : mode === 'festival'
        ? festNames[r.usedTemplateIndex ?? 0] ?? `Template #${(r.usedTemplateIndex ?? 0) + 1}`
        : '';

      if (mode === 'manual') {
        pushHistory({ label: 'Manual Message Sent', sub: 'To: #general-channel', ts: Date.now(), kind: 'manual' });
      } else if (mode === 'birthday') {
        pushHistory({ label: `Birthday Trigger${birthdayName ? `: ${birthdayName}` : ''}`, sub: `Template: ${usedName}`, ts: Date.now(), kind: 'birthday' });
      } else {
        pushHistory({ label: `Festival Trigger: ${settings.festivalName || 'Festival'}`, sub: `Template: ${usedName}`, ts: Date.now(), kind: 'festival' });
      }
      toast({ title: 'Sent!', description: `${r.sentCount ?? 1} message(s) delivered to Google Chat.` });
    } finally {
      setSending(false);
    }
  }

  /* ── template helpers ──────────────────────────────────────────────────────── */
  function startEditBday(idx: number) {
    setEditBuf({ name: bdayNames[idx] ?? `Template #${idx + 1}`, msg: settings.birthdayTemplates[idx] ?? '' });
    setEditingBday(idx);
    setEditingFest(null);
  }
  function commitEditBday(idx: number) {
    setBdayNames((p) => { const n = [...p]; n[idx] = editBuf.name || `Template #${idx + 1}`; return n; });
    setSettings((p) => ({ ...p, birthdayTemplates: p.birthdayTemplates.map((t, i) => i === idx ? editBuf.msg : t) }));
    setEditingBday(null);
  }
  function startEditFest(idx: number) {
    setEditBuf({ name: festNames[idx] ?? `Template #${idx + 1}`, msg: settings.festivalTemplates[idx] ?? '' });
    setEditingFest(idx);
    setEditingBday(null);
  }
  function commitEditFest(idx: number) {
    setFestNames((p) => { const n = [...p]; n[idx] = editBuf.name || `Template #${idx + 1}`; return n; });
    setSettings((p) => ({ ...p, festivalTemplates: p.festivalTemplates.map((t, i) => i === idx ? editBuf.msg : t) }));
    setEditingFest(null);
  }
  function addBdayTemplate() {
    setSettings((p) => ({ ...p, birthdayTemplates: [...p.birthdayTemplates, 'Happy Birthday {name}! 🎂'] }));
    setBdayNames((p) => [...p, `Template #${p.length + 1}`]);
  }
  function addFestTemplate() {
    setSettings((p) => ({ ...p, festivalTemplates: [...p.festivalTemplates, 'Happy {festivalName}! ✨'] }));
    setFestNames((p) => [...p, `Template #${p.length + 1}`]);
  }
  function removeBday(idx: number) {
    if (settings.birthdayTemplates.length <= 1) return;
    setSettings((p) => { const n = p.birthdayTemplates.filter((_, i) => i !== idx); return { ...p, birthdayTemplates: n }; });
    setBdayNames((p) => p.filter((_, i) => i !== idx));
  }
  function removeFest(idx: number) {
    if (settings.festivalTemplates.length <= 1) return;
    setSettings((p) => { const n = p.festivalTemplates.filter((_, i) => i !== idx); return { ...p, festivalTemplates: n }; });
    setFestNames((p) => p.filter((_, i) => i !== idx));
  }

  /* ── festival handlers ───────────────────────────────────────────────────── */
  async function handlePdfUpload(file: File) {
    setFestParsedPreview(null);
    setFestPdfParsing(true);
    try {
      // Extract text from PDF client-side using pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str || '').join(' ') + '\n';
      }
      if (!fullText.trim()) {
        toast({ title: 'No text found in PDF', description: 'Make sure the PDF contains selectable text.', variant: 'destructive' });
        return;
      }
      const result = await parseFestivalsFromText(fullText);
      if (!result.festivals.length) {
        toast({ title: 'No festivals detected', description: 'Could not find festival names with dates in the PDF.', variant: 'destructive' });
        return;
      }
      setFestParsedPreview(result.festivals);
      setFestPdfSource(result.source);
      toast({ title: `Found ${result.festivals.length} festival(s)`, description: result.source === 'ai' ? 'AI extracted the data' : 'Regex extracted the data' });
    } catch (e: unknown) {
      toast({ title: 'PDF parsing failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setFestPdfParsing(false);
    }
  }

  async function importParsedFestivals() {
    if (!festParsedPreview?.length) return;
    setFestImporting(true);
    let imported = 0;
    for (const f of festParsedPreview) {
      const created = await createFestival({ name: f.name, monthDay: f.monthDay, emoji: f.emoji || '🎉', enabled: false });
      if (created) imported++;
    }
    toast({ title: `Imported ${imported} festival(s)` });
    setFestParsedPreview(null);
    await loadFestivals();
    setFestImporting(false);
  }

  async function toggleFestival(fest: FestivalRow) {
    const updated = await updateFestival(fest.id, { enabled: !fest.enabled });
    if (updated) setFestivals(prev => prev.map(f => f.id === fest.id ? updated : f));
  }

  async function handleBulkEnable(enabled: boolean) {
    setBulkEnabling(true);
    const list = await bulkEnableFestivals('all', enabled);
    if (list.length) setFestivals(list);
    setBulkEnabling(false);
    toast({ title: enabled ? 'All festivals enabled' : 'All festivals disabled' });
  }

  function startEditFestival(fest: FestivalRow) {
    setEditingFestId(fest.id);
    setEditingFestBuf({ name: fest.name, monthDay: fest.monthDay, emoji: fest.emoji, templateMessage: fest.templateMessage });
  }

  async function commitEditFestival() {
    if (!editingFestId) return;
    const updated = await updateFestival(editingFestId, editingFestBuf);
    if (updated) setFestivals(prev => prev.map(f => f.id === editingFestId ? updated : f));
    setEditingFestId(null);
  }

  async function suggestTemplate(fest: FestivalRow) {
    setSuggestingId(fest.id);
    const result = await suggestFestivalTemplate(fest.id);
    if (result.message) {
      const updated = await updateFestival(fest.id, { templateMessage: result.message });
      if (updated) setFestivals(prev => prev.map(f => f.id === fest.id ? updated : f));
      toast({ title: result.source === 'ai' ? 'AI suggested a template' : 'Template suggested' });
    } else {
      toast({ title: 'Could not suggest template', variant: 'destructive' });
    }
    setSuggestingId(null);
  }

  async function handleDeleteFestival(id: string) {
    const ok = await deleteFestival(id);
    if (ok) setFestivals(prev => prev.filter(f => f.id !== id));
  }

  function formatMonthDay(md: string) {
    if (!md || !/^\d{2}-\d{2}$/.test(md)) return md;
    try {
      const d = new Date(`2000-${md}`);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return md; }
  }

  const automationEnabled = settings.autoBirthdayEnabled || settings.autoFestivalEnabled;
  const allTemplateVarsFilled = (selectedEmailTemplate?.variables ?? []).every(
    (v) => String(emailVars[v] ?? '').trim().length > 0
  );

  /* ── render ─────────────────────────────────────────────────────────────────── */
  return (
    <>
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Announcements"
        description="Send manual and template-based Google Chat announcements to your global workspace."
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/30 border border-border/50 rounded-xl p-1 w-fit flex-wrap">
        {([['manual', 'Manual'], ['templates', 'Templates'], ['festivals', 'Festivals 🎉'], ['email', '✉️ Email']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── MANUAL TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <div className="space-y-5">
          {/* Manual Announcement */}
          <SectionCard title="Manual Announcement">
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value.slice(0, 1000))}
                  rows={5}
                  placeholder="Type your global announcement here... Use @name to tag specific departments."
                  className="resize-none bg-muted/20 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{manualText.length} / 1000 characters</span>
                <Button
                  onClick={() => void trigger('manual')}
                  disabled={sending || !manualText.trim()}
                  size="sm"
                  className="gap-2 rounded-lg"
                >
                  <Send className="w-3.5 h-3.5" /> Send Manual Message
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* System Triggers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel title="System Triggers" />
              {automationEnabled && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Automation Enabled
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Birthday Trigger Card */}
              <TriggerCard
                icon={<UserRound className="w-5 h-5" />}
                title="Birthday Trigger"
                topLabel="EMPLOYEE NAME"
                topSlot={
                  <Input
                    value={birthdayName}
                    onChange={(e) => setBirthdayName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="h-9 bg-muted/20 border-border/50 rounded-lg text-sm"
                  />
                }
                bottomLabel="SELECT TEMPLATE"
                bottomSlot={
                  <Select value={birthdayTplIdx} onValueChange={setBirthdayTplIdx}>
                    <SelectTrigger className="h-9 bg-muted/20 border-border/50 rounded-lg text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (next in rotation)</SelectItem>
                      {settings.birthdayTemplates.map((_, i) => (
                        <SelectItem key={i} value={String(i)}>{bdayNames[i] ?? `Template #${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
                button={
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-sm gap-2 border-border/50"
                    onClick={() => void trigger('birthday')}
                    disabled={sending}
                  >
                    <Cake className="w-4 h-4" /> Trigger Birthday
                  </Button>
                }
              />

              {/* Festival Trigger Card */}
              <TriggerCard
                icon={<PartyPopper className="w-5 h-5" />}
                title="Festival Trigger"
                topLabel="ACTIVE OCCASION"
                topSlot={
                  <div className="flex items-center gap-2 h-9 px-3 bg-muted/20 border border-border/50 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <Input
                      value={settings.festivalName}
                      onChange={(e) => setSettings((p) => ({ ...p, festivalName: e.target.value }))}
                      placeholder="e.g. Lunar New Year 2024"
                      className="h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                    />
                  </div>
                }
                bottomLabel="SELECT TEMPLATE"
                bottomSlot={
                  <Select value={festivalTplIdx} onValueChange={setFestivalTplIdx}>
                    <SelectTrigger className="h-9 bg-muted/20 border-border/50 rounded-lg text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (next in rotation)</SelectItem>
                      {settings.festivalTemplates.map((_, i) => (
                        <SelectItem key={i} value={String(i)}>{festNames[i] ?? `Template #${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
                button={
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-sm gap-2 border-border/50"
                    onClick={() => void trigger('festival')}
                    disabled={sending}
                  >
                    <Sparkles className="w-4 h-4" /> Trigger Festival
                  </Button>
                }
              />
            </div>
          </div>

          {/* Bottom row: History + Pro Tip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recent History */}
            <div className="md:col-span-2 rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Recent History</span>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</button>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No messages sent yet in this session.</p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        h.kind === 'manual' ? 'bg-blue-400' : h.kind === 'birthday' ? 'bg-rose-400' : 'bg-amber-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none">{h.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{h.sub}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">{timeAgo(h.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pro Tip */}
            <div className="rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/20 p-4 flex flex-col justify-between">
              <div>
                <p className="text-sm font-bold text-blue-300 mb-2">Pro Tip</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Templates with dynamic variables like <code className="text-blue-300">{'{name}'}</code> and{' '}
                  <code className="text-blue-300">{'{department}'}</code> see 40% higher engagement on Google Chat.
                </p>
              </div>
              <button
                onClick={() => setTab('templates')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Manage Templates <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FESTIVALS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'festivals' && (
        <div className="space-y-5">
          {/* PDF Upload Card */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Import Festival Calendar from PDF</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upload a PDF containing festival names and dates — AI will extract and set them up automatically.</p>
              </div>
            </div>

            <div
              className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => festFileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') handlePdfUpload(f); }}
            >
              <input ref={festFileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = ''; }} />
              {festPdfParsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Reading PDF & extracting festivals…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop PDF here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Festival names + dates will be auto-detected</p>
                </div>
              )}
            </div>

            {/* Parsed preview */}
            {festParsedPreview && festParsedPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Detected {festParsedPreview.length} Festival(s)
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${festPdfSource === 'ai' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {festPdfSource === 'ai' ? '✦ AI' : 'Regex'}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => setFestParsedPreview(null)}>Discard</Button>
                    <Button size="sm" className="rounded-lg h-8 text-xs gap-1.5 shadow-md shadow-primary/20" onClick={importParsedFestivals} disabled={festImporting}>
                      {festImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                      Import All
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {festParsedPreview.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40">
                      <span className="text-lg">{f.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatMonthDay(f.monthDay)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Festival List */}
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-sm">Festival Calendar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {festivals.filter(f => f.enabled).length} of {festivals.length} enabled for auto-trigger
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm" variant="outline"
                  className="rounded-lg h-8 text-xs gap-1.5"
                  onClick={() => void handleBulkEnable(false)}
                  disabled={bulkEnabling || festivals.every(f => !f.enabled)}
                >
                  <ToggleLeft className="w-3.5 h-3.5" /> Disable All
                </Button>
                <Button
                  size="sm"
                  className="rounded-lg h-8 text-xs gap-1.5 shadow-md shadow-primary/20"
                  onClick={() => void handleBulkEnable(true)}
                  disabled={bulkEnabling || festivals.every(f => f.enabled)}
                >
                  {bulkEnabling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ToggleRight className="w-3.5 h-3.5" />} Enable All
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="rounded-lg h-8 text-xs gap-1.5"
                  onClick={() => { setEditingFestId('__new__'); setEditingFestBuf({ name: '', monthDay: '', emoji: '🎉', templateMessage: '' }); }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>

            {/* Add new row */}
            {editingFestId === '__new__' && (
              <div className="px-5 py-3 border-b border-border/30 bg-primary/5 grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                <Input value={editingFestBuf.emoji} onChange={e => setEditingFestBuf(b => ({ ...b, emoji: e.target.value }))} className="h-8 w-14 text-center text-lg rounded-lg bg-muted/30 border-border/50" placeholder="🎉" />
                <Input value={editingFestBuf.name} onChange={e => setEditingFestBuf(b => ({ ...b, name: e.target.value }))} className="h-8 text-xs rounded-lg bg-muted/30 border-border/50" placeholder="Festival name" />
                <Input type="date" value={editingFestBuf.monthDay ? `2000-${editingFestBuf.monthDay}` : ''} onChange={e => setEditingFestBuf(b => ({ ...b, monthDay: e.target.value.slice(5) }))} className="h-8 text-xs rounded-lg bg-muted/30 border-border/50 [color-scheme:dark]" />
                <div className="flex gap-1">
                  <button onClick={async () => { if (!editingFestBuf.name || !editingFestBuf.monthDay) return; const created = await createFestival({ ...editingFestBuf, enabled: false }); if (created) { setFestivals(prev => [...prev, created]); setEditingFestId(null); } }} className="w-7 h-7 flex items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-400/10"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingFestId(null)} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}

            {festivalsLoading ? (
              <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></div>
            ) : festivals.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No festivals yet. Upload a PDF or add one manually.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {festivals.map(fest => (
                  <div key={fest.id} className={`px-5 py-3.5 transition-colors ${fest.enabled ? 'bg-success/3' : ''}`}>
                    {editingFestId === fest.id ? (
                      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                        <Input value={editingFestBuf.emoji} onChange={e => setEditingFestBuf(b => ({ ...b, emoji: e.target.value }))} className="h-8 w-14 text-center text-lg rounded-lg bg-muted/30" placeholder="🎉" />
                        <Input value={editingFestBuf.name} onChange={e => setEditingFestBuf(b => ({ ...b, name: e.target.value }))} className="h-8 text-xs rounded-lg bg-muted/30" placeholder="Name" />
                        <Input type="date" value={editingFestBuf.monthDay ? `2000-${editingFestBuf.monthDay}` : ''} onChange={e => setEditingFestBuf(b => ({ ...b, monthDay: e.target.value.slice(5) }))} className="h-8 text-xs rounded-lg bg-muted/30 [color-scheme:dark]" />
                        <Input value={editingFestBuf.templateMessage} onChange={e => setEditingFestBuf(b => ({ ...b, templateMessage: e.target.value }))} className="h-8 text-xs rounded-lg bg-muted/30" placeholder="Template message (optional)" />
                        <div className="flex gap-1">
                          <button onClick={() => void commitEditFestival()} className="w-7 h-7 flex items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-400/10"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingFestId(null)} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xl w-8 text-center">{fest.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{fest.name}</span>
                            <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">{formatMonthDay(fest.monthDay)}</span>
                            {fest.enabled && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">● Active</span>}
                          </div>
                          {fest.templateMessage ? (
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-lg">{fest.templateMessage}</p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5 italic">No template — click ✦ to generate</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            title="AI suggest template"
                            onClick={() => void suggestTemplate(fest)}
                            disabled={suggestingId === fest.id}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                          >
                            {suggestingId === fest.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => startEditFestival(fest)} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => void handleDeleteFestival(fest.id)} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <Switch checked={fest.enabled} onCheckedChange={() => void toggleFestival(fest)} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground text-sm">How festival auto-triggers work</p>
            <p>• Each festival with a toggle <span className="text-success font-semibold">enabled</span> will automatically send its template message to Google Chat on the configured date every year.</p>
            <p>• Click <span className="inline-flex items-center gap-1 text-primary"><Wand2 className="w-3 h-3" /> Wand</span> on any festival to let AI write a warm message for it.</p>
            <p>• Use <code className="bg-muted px-1 rounded">{'{festivalName}'}</code> in the template to dynamically insert the festival name.</p>
          </div>
        </div>
      )}

      {/* ── EMAIL TAB ──────────────────────────────────────────────────────────── */}
      {tab === 'email' && (
        <div className="space-y-5">
          {/* Config status */}
          <div className={`rounded-xl border p-4 ${
            emailConfigured === false
              ? 'border-amber-500/30 bg-amber-500/10'
              : emailConfigured === true
              ? 'border-border/50 bg-card/50'
              : 'border-border/30 bg-muted/10'
          }`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${emailConfigured === true ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                  <Mail className={`w-4 h-4 ${emailConfigured === true ? 'text-emerald-400' : 'text-amber-400'}`} />
                </div>
                <div className="min-w-0">
                  {emailConfigured === false ? (
                    <>
                      <p className="text-sm font-semibold text-amber-300">Gmail SMTP not configured</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add <code className="bg-muted/60 px-1 rounded text-amber-300">EMAIL_FROM</code> and <code className="bg-muted/60 px-1 rounded text-amber-300">EMAIL_PASS</code> to your <code className="bg-muted/60 px-1 rounded">.env</code> file.
                      </p>
                    </>
                  ) : emailConfigured === true ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">SMTP configured</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Sending from <span className="text-foreground font-medium">{emailFrom}</span> — click Test to verify the connection.</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Checking email config…</p>
                  )}
                  {/* Verify result */}
                  {verifyResult && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${verifyResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
                      {verifyResult.ok ? (
                        <span>✓ {verifyResult.message}</span>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold">✗ Authentication failed</p>
                          {verifyResult.hint && <p className="text-rose-200/80">{verifyResult.hint}</p>}
                          <p className="text-[10px] opacity-60 mt-1 font-mono break-all">{verifyResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleVerifyEmail()}
                disabled={verifyingEmail || emailConfigured === false}
                className="gap-1.5 h-8 rounded-lg text-xs shrink-0"
              >
                {verifyingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {verifyingEmail ? 'Testing…' : 'Test Connection'}
              </Button>
            </div>

            {/* Gmail App Password step-by-step when not working */}
            {verifyResult && !verifyResult.ok && (
              <div className="mt-3 pt-3 border-t border-rose-500/20 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground text-xs">How to fix — Generate a Gmail App Password:</p>
                <p>1. Go to <span className="text-primary font-medium">myaccount.google.com/security</span> → enable <strong>2-Step Verification</strong></p>
                <p>2. Then go to <span className="text-primary font-medium">myaccount.google.com/apppasswords</span></p>
                <p>3. Click <strong>Create</strong>, name it <strong>HRMS Mailer</strong>, copy the 16-char password</p>
                <p>4. Paste it into <code className="bg-muted px-1 rounded">.env</code> as <code className="bg-muted px-1 rounded">EMAIL_PASS="abcd efgh ijkl mnop"</code> (spaces are fine)</p>
                <p>5. Save — the server restarts automatically. Then click <strong>Test Connection</strong> again.</p>
              </div>
            )}
          </div>

          {/* ── MAIN COMPOSE CARD ─── */}
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mail className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Send Email From Template</p>
                <p className="text-xs text-muted-foreground mt-0.5">Select the template you want to use, fill dynamic fields, and send to recipient.</p>
              </div>
            </div>

            {emailTemplatesLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <div className="p-6 space-y-5">

                {/* Template selector */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Template <span className="text-rose-400">*</span>
                  </Label>
                  <Select value={selectedTemplateId} onValueChange={onSelectEmailTemplate}>
                    <SelectTrigger className="h-11 bg-muted/20 border-border/50 rounded-xl text-sm">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Recipient email — full width, prominent */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Recipient Email <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="Send to employee's personal email address…"
                    className="h-11 bg-muted/20 border-border/50 rounded-xl text-sm"
                  />
                </div>

                {/* Divider with label */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Credentials to Send</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>

                {/* Dynamic fields from selected template */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(selectedEmailTemplate?.variables ?? []).map((v) => {
                    const isPassword = /password/i.test(v);
                    const label = v.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
                    return (
                      <div key={v} className="space-y-1.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {label} <span className="text-rose-400">*</span>
                        </Label>
                        {isPassword ? (
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              value={emailVars[v] ?? ''}
                              onChange={(e) => setEmailVars((p) => ({ ...p, [v]: e.target.value }))}
                              placeholder={`Enter ${label.toLowerCase()}`}
                              className="h-10 bg-muted/20 border-border/50 rounded-xl text-sm pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((p) => !p)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        ) : (
                          <Input
                            value={emailVars[v] ?? ''}
                            onChange={(e) => setEmailVars((p) => ({ ...p, [v]: e.target.value }))}
                            placeholder={`Enter ${label.toLowerCase()}`}
                            className="h-10 bg-muted/20 border-border/50 rounded-xl text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Preview toggle */}
                {selectedEmailTemplate && (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowPreview((p) => !p)}
                      className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {showPreview ? 'Hide Email Preview' : 'Preview Email'}
                      {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showPreview && (
                      <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">Subject:</span>
                          <span className="text-xs text-foreground font-semibold">
                            <EmailBodyPreview text={selectedEmailTemplate.subject} vars={emailVars} />
                          </span>
                        </div>
                        <div className="px-5 py-4 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80">
                          <EmailBodyPreview text={selectedEmailTemplate.body} vars={emailVars} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments + Send row */}
                <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
                  {/* Attachments */}
                  <div className="flex items-center flex-wrap gap-2">
                    {emailAttachments.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        <button onClick={() => setEmailAttachments((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => emailAttachRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> Attach Files
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const f = fileFromEmailDraftStash();
                        if (!f) {
                          toast({
                            title: 'No draft saved',
                            description: 'Use Documents → Auto-Docs → Draft download first, then return here.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setEmailAttachments((prev) => {
                          const dup = prev.some((x) => x.name === f.name && x.size === f.size);
                          if (dup) return prev;
                          return [...prev, f];
                        });
                        toast({ title: 'Draft attached', description: f.name });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 bg-muted/20 transition-all"
                      title={emailDraftMeta ? `Last draft: ${emailDraftMeta.fileName}` : 'Attach the last Auto-Docs draft'}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>Draft files</span>
                      {emailDraftMeta ? (
                        <span className="max-w-[100px] truncate opacity-70" title={emailDraftMeta.fileName}>
                          ({emailDraftMeta.fileName})
                        </span>
                      ) : null}
                    </button>
                    <input ref={emailAttachRef} type="file" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); setEmailAttachments((p) => [...p, ...files]); e.target.value = ''; }} />
                  </div>

                  {/* Send button */}
                  <Button
                    onClick={() => void handleSendEmail()}
                    disabled={emailSending || !emailTo.trim() || !selectedTemplateId || emailConfigured === false || !allTemplateVarsFilled}
                    size="lg"
                    className="gap-2 rounded-xl shadow-md shadow-primary/20 px-6"
                  >
                    {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {emailSending ? 'Sending…' : 'Send email'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── TEMPLATES PANEL (collapsible) ─── */}
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            <button
              className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
              onClick={() => setShowTemplatesPanel((p) => !p)}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Email Templates</span>
                <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{emailTemplates.length}</span>
              </div>
              {showTemplatesPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showTemplatesPanel && (
              <div className="border-t border-border/40">
                {/* Sub-header — tips + actions */}
                <div className="px-5 py-4 border-b border-border/30 bg-gradient-to-r from-muted/25 via-muted/10 to-transparent">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-2 max-w-2xl">
                      <p className="text-sm font-semibold tracking-tight">Placeholders &amp; fields</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Use <code className="px-1.5 py-0.5 rounded-md bg-muted border border-border/50 font-mono text-[11px] text-rose-400">{`{{name}}`}</code>
                        {' '}-style tokens in <span className="text-foreground/90">subject</span> and <span className="text-foreground/90">body</span>.
                        Each unique name becomes one input when sending. For two logins, use different names — e.g.{' '}
                        <code className="font-mono text-[10px] text-primary">{`{{workspaceEmail}}`}</code>,{' '}
                        <code className="font-mono text-[10px] text-primary">{`{{portalPassword}}`}</code>.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={showPdfImport ? 'secondary' : 'outline'}
                        className="gap-1.5 text-xs h-9 rounded-lg border-blue-500/35 text-blue-400 hover:bg-blue-500/10"
                        onClick={() => { setShowPdfImport((p) => !p); setShowAddEmailTpl(false); setParsedPdfSegments(null); setEditingEmailTplId(null); }}
                      >
                        <Upload className="w-3.5 h-3.5" /> Import PDF
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={showAddEmailTpl ? 'secondary' : 'default'}
                        className="gap-1.5 text-xs h-9 rounded-lg shadow-sm shadow-primary/15"
                        onClick={() => { setShowAddEmailTpl((p) => !p); setShowPdfImport(false); setEditingEmailTplId(null); }}
                      >
                        <Plus className="w-3.5 h-3.5" /> New template
                      </Button>
                    </div>
                  </div>
                </div>

                {/* PDF Import Section */}
            {showPdfImport && (
              <div className="p-5 border-b border-border/40 bg-blue-500/5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-300">Import PDF Template</p>
                    <p className="text-xs text-muted-foreground">Black text stays static. Red text becomes dynamic <span className="text-rose-400 font-mono">{`{{fields}}`}</span>.</p>
                  </div>
                </div>

                {!parsedPdfSegments ? (
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${pdfParsing ? 'border-primary/40 bg-primary/5' : 'border-border/60 hover:border-blue-500/50 hover:bg-blue-500/5'}`}
                    onClick={() => !pdfParsing && pdfImportFileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') void handlePdfTemplateUpload(f); }}
                  >
                    <input ref={pdfImportFileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePdfTemplateUpload(f); e.target.value = ''; }} />
                    {pdfParsing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                        <p className="text-sm text-muted-foreground">Reading PDF and detecting colored text…</p>
                        <p className="text-xs text-muted-foreground/60">Black = static • Red = dynamic field</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-1">
                          <Upload className="w-6 h-6 text-blue-400" />
                        </div>
                        <p className="text-sm font-semibold">Drop your PDF template here</p>
                        <p className="text-xs text-muted-foreground">or click to browse files</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-foreground/70" /> Black text = static</span>
                          <span className="flex items-center gap-1.5 text-xs text-rose-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Red text = dynamic field</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Detected structure preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detected Structure</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-foreground/50" /> Static text</span>
                          <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-500" /> Dynamic field</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/10 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                        {(() => {
                          let rIdx = 0;
                          return parsedPdfSegments.map((seg, i) => {
                            if (seg.isRed) {
                              const nm = pdfFieldNames[rIdx]?.trim() || `field${rIdx + 1}`;
                              rIdx++;
                              return <span key={i} className="text-rose-400 bg-rose-500/15 rounded px-0.5 border border-rose-500/30">{`{{${nm}}}`}</span>;
                            }
                            return <span key={i} className="text-foreground/80">{seg.text}</span>;
                          });
                        })()}
                      </div>
                    </div>

                    {/* Name the detected red fields */}
                    {pdfFieldNames.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Name Dynamic Fields <span className="text-rose-400 font-normal normal-case">({pdfFieldNames.length} detected)</span>
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {pdfFieldNames.map((name, i) => (
                            <div key={i} className="space-y-1">
                              <Label className="text-[10px] text-rose-400/80 font-mono">Field {i + 1}</Label>
                              <Input
                                value={name}
                                onChange={(e) => setPdfFieldNames((p) => p.map((n, j) => j === i ? e.target.value : n))}
                                placeholder={`field${i + 1}`}
                                className="h-8 text-xs bg-muted/30 rounded-lg border-rose-500/30 focus:border-rose-500/60"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Template name + subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Template Name</Label>
                        <Input value={pdfTplName} onChange={(e) => setPdfTplName(e.target.value)} placeholder="e.g. Offer Letter" className="h-9 text-xs bg-muted/30 rounded-lg border-border/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Email Subject</Label>
                        <Input value={pdfTplSubject} onChange={(e) => setPdfTplSubject(e.target.value)} placeholder="e.g. Your Offer Letter — Gluck Global" className="h-9 text-xs bg-muted/30 rounded-lg border-border/50" />
                      </div>
                    </div>

                    <div className="flex justify-between gap-2">
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs gap-1.5 text-muted-foreground" onClick={() => { setParsedPdfSegments(null); setPdfFieldNames([]); }}>
                        <Upload className="w-3 h-3" /> Upload Different PDF
                      </Button>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => { setShowPdfImport(false); setParsedPdfSegments(null); }}>Cancel</Button>
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                          onClick={() => void handleSavePdfTemplate()}
                          disabled={pdfSaving || !pdfTplName.trim() || !pdfTplSubject.trim()}
                        >
                          {pdfSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Create Template
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Template Form */}
            {showAddEmailTpl && (
              <div className="m-4 rounded-xl border border-primary/25 bg-primary/[0.07] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-primary">Create template</p>
                  <Button type="button" size="sm" variant="ghost" className="h-8 text-xs rounded-lg" onClick={() => setShowAddEmailTpl(false)}>Dismiss</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Name</Label>
                    <Input value={newEmailTpl.name} onChange={(e) => setNewEmailTpl((b) => ({ ...b, name: e.target.value }))} placeholder="Internal label" className="h-10 text-sm bg-background/60 rounded-lg border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Subject line</Label>
                    <Input value={newEmailTpl.subject} onChange={(e) => setNewEmailTpl((b) => ({ ...b, subject: e.target.value }))} placeholder="Recipients see this subject" className="h-10 text-sm bg-background/60 rounded-lg border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Category</Label>
                    <Input value={newEmailTpl.category} onChange={(e) => setNewEmailTpl((b) => ({ ...b, category: e.target.value }))} placeholder="e.g. Onboarding" className="h-10 text-sm bg-background/60 rounded-lg border-border/50" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Body</Label>
                  <Textarea
                    value={newEmailTpl.body}
                    onChange={(e) => setNewEmailTpl((b) => ({ ...b, body: e.target.value }))}
                    rows={10}
                    spellCheck
                    placeholder={'Dear {{name}},\n\n...'}
                    className="min-h-[200px] text-sm bg-background/60 rounded-xl border-border/50 resize-y font-mono leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Detected fields:{' '}
                    {detectEmailTemplateVars(newEmailTpl.body, newEmailTpl.subject).length ? (
                      detectEmailTemplateVars(newEmailTpl.body, newEmailTpl.subject).map((v) => (
                        <code key={v} className="mx-0.5 px-1 rounded bg-rose-500/15 text-rose-400 font-mono text-[10px] border border-rose-500/25">{`{{${v}}}`}</code>
                      ))
                    ) : (
                      <span className="italic">none yet</span>
                    )}
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowAddEmailTpl(false)}>Cancel</Button>
                  <Button type="button" size="sm" className="h-9 rounded-lg text-xs gap-2 shadow-md shadow-primary/20" onClick={() => void handleSaveNewEmailTpl()} disabled={emailSavingTpl || !newEmailTpl.name?.trim() || !newEmailTpl.subject?.trim() || !newEmailTpl.body?.trim()}>
                    {emailSavingTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save template
                  </Button>
                </div>
              </div>
            )}

            {/* Template list */}
            {emailTemplatesLoading ? (
              <div className="py-14 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading templates…</p>
              </div>
            ) : emailTemplates.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-2">
                <p className="text-sm font-medium text-foreground">No templates yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">Create one with <strong>New template</strong> or import a PDF. Then choose it in the compose card above.</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {emailTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`rounded-xl border transition-colors ${
                      selectedTemplateId === tpl.id
                        ? 'border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20'
                        : 'border-border/45 bg-card/40 hover:bg-muted/15 hover:border-border'
                    }`}
                  >
                    {editingEmailTplId === tpl.id ? (
                      <div className="p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <p className="text-sm font-semibold">Edit template</p>
                          <p className="text-[11px] text-muted-foreground">Changes apply to the template used when sending.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Name</Label>
                            <Input value={editEmailTplBuf.name} onChange={(e) => setEditEmailTplBuf((b) => ({ ...b, name: e.target.value }))} className="h-10 text-sm bg-background/50 rounded-lg" />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Subject</Label>
                            <Input value={editEmailTplBuf.subject} onChange={(e) => setEditEmailTplBuf((b) => ({ ...b, subject: e.target.value }))} className="h-10 text-sm bg-background/50 rounded-lg" />
                          </div>
                          <div className="space-y-1.5 sm:col-span-3">
                            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Category</Label>
                            <Input value={editEmailTplBuf.category} onChange={(e) => setEditEmailTplBuf((b) => ({ ...b, category: e.target.value }))} className="h-10 text-sm bg-background/50 rounded-lg max-w-xs" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Body</Label>
                          <Textarea
                            value={editEmailTplBuf.body}
                            onChange={(e) => setEditEmailTplBuf((b) => ({ ...b, body: e.target.value }))}
                            rows={12}
                            spellCheck
                            className="min-h-[220px] text-sm bg-background/50 rounded-xl border-border/50 resize-y font-mono leading-relaxed"
                          />
                          <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
                            <span className="font-medium text-foreground/80 shrink-0">Live fields:</span>
                            {detectEmailTemplateVars(editEmailTplBuf.body, editEmailTplBuf.subject).length ? (
                              detectEmailTemplateVars(editEmailTplBuf.body, editEmailTplBuf.subject).map((v) => (
                                <code key={v} className="px-1.5 py-0.5 rounded-md bg-rose-500/12 text-rose-400 font-mono text-[10px] border border-rose-500/25">{`{{${v}}}`}</code>
                              ))
                            ) : (
                              <span className="italic">Add placeholders like {`{{name}}`}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-border/30">
                          <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setEditingEmailTplId(null)}>Cancel</Button>
                          <Button type="button" size="sm" className="h-9 rounded-lg text-xs gap-2" onClick={() => void handleUpdateEmailTpl()} disabled={emailSavingTpl}>
                            {emailSavingTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{tpl.name}</span>
                            {tpl.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-semibold border border-primary/20">Default</span>}
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50">{tpl.category}</span>
                            {selectedTemplateId === tpl.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/25">Selected for send</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{tpl.subject}</p>
                          {tpl.variables.length > 0 && (
                            <div className="flex items-center gap-1 pt-1 flex-wrap">
                              {tpl.variables.map((v) => (
                                <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">{`{{${v}}}`}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs rounded-lg"
                            onClick={() => { onSelectEmailTemplate(tpl.id); toast({ title: 'Template selected', description: tpl.name }); }}
                          >
                            Use
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => { setEditingEmailTplId(tpl.id); setEditEmailTplBuf({ name: tpl.name, subject: tpl.subject, body: tpl.body, category: tpl.category }); setShowAddEmailTpl(false); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => void handleDeleteEmailTpl(tpl.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATES TAB ──────────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading templates…</p>
          ) : (
            <>
              {/* Birthday Templates */}
              <TemplateSection
                title="Birthday Templates"
                subtitle="Manage automated messages for employee birthdays."
                onAdd={addBdayTemplate}
                names={bdayNames}
                templates={settings.birthdayTemplates}
                editingIdx={editingBday}
                editBuf={editBuf}
                setEditBuf={setEditBuf}
                onStartEdit={startEditBday}
                onCommitEdit={commitEditBday}
                onCancelEdit={() => setEditingBday(null)}
                onRemove={removeBday}
              />

              {/* Festival Templates */}
              <TemplateSection
                title="Festival Templates"
                subtitle="Seasonal and cultural celebration announcements."
                onAdd={addFestTemplate}
                names={festNames}
                templates={settings.festivalTemplates}
                editingIdx={editingFest}
                editBuf={editBuf}
                setEditBuf={setEditBuf}
                onStartEdit={startEditFest}
                onCommitEdit={commitEditFest}
                onCancelEdit={() => setEditingFest(null)}
                onRemove={removeFest}
              />

              {/* Auto Triggers + Festival Config */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Auto Triggers */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
                  <p className="text-sm font-semibold">Auto Triggers</p>
                  <ToggleRow
                    label="Auto Birthday Trigger"
                    checked={settings.autoBirthdayEnabled}
                    onChange={(v) => setSettings((p) => ({ ...p, autoBirthdayEnabled: v }))}
                    dot="bg-blue-400"
                  />
                  <ToggleRow
                    label="Auto Festival Trigger"
                    checked={settings.autoFestivalEnabled}
                    onChange={(v) => setSettings((p) => ({ ...p, autoFestivalEnabled: v }))}
                    dot="bg-muted-foreground/40"
                  />
                </div>

                {/* Right: Festival Name + Date */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Festival Name</Label>
                    <Input
                      value={settings.festivalName}
                      onChange={(e) => setSettings((p) => ({ ...p, festivalName: e.target.value }))}
                      placeholder="e.g. Founder's Day"
                      className="h-10 bg-muted/20 border-border/50 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Festival Date</Label>
                    <Input
                      type="date"
                      value={monthDayToInputDate(settings.festivalMonthDay)}
                      onChange={(e) => setSettings((p) => ({ ...p, festivalMonthDay: inputDateToMonthDay(e.target.value) }))}
                      className="h-10 bg-muted/20 border-border/50 rounded-lg pr-10 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-5 py-3.5">
                <p className="text-xs text-muted-foreground">
                  {settings.lastBirthdayRunOn
                    ? `Last auto run: ${settings.lastBirthdayRunOn} — 09:00 AM`
                    : 'Auto announcements have not run yet.'}
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" className="rounded-lg text-sm" onClick={discardChanges} disabled={saving}>
                    Discard Changes
                  </Button>
                  <Button size="sm" className="rounded-lg gap-2 text-sm" onClick={() => void saveTemplates()} disabled={saving}>
                    <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Templates'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>

    <Dialog open={emailSendReceipt !== null} onOpenChange={(open) => { if (!open) setEmailSendReceipt(null); }}>
      <DialogContent className="max-w-xl max-h-[min(90vh,720px)] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-xl">
        {emailSendReceipt && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 space-y-3 border-b border-border/50 shrink-0 text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="text-left">Email sent — verify details</DialogTitle>
                  <DialogDescription className="text-left text-xs leading-relaxed">
                    This is exactly what was submitted to the mail server. Confirm the recipient, sender, and content look correct.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/40 text-xs">
                <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-0 px-3.5 py-2.5 items-baseline">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wide">From</span>
                  <span className="font-mono text-foreground break-all">{emailSendReceipt.from}</span>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-x-3 px-3.5 py-2.5 items-baseline">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wide">To</span>
                  <span className="font-mono text-foreground break-all">{emailSendReceipt.to}</span>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-x-3 px-3.5 py-2.5 items-baseline">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wide">Template</span>
                  <span className="text-foreground">{emailSendReceipt.templateName}</span>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-x-3 px-3.5 py-2.5 items-baseline">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wide">Sent</span>
                  <span className="text-muted-foreground">{new Date(emailSendReceipt.sentAt).toLocaleString()}</span>
                </div>
              </div>

              {emailSendReceipt.serverMessage && (
                <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-card/40 px-3 py-2">
                  <span className="font-semibold text-foreground">Server: </span>
                  {emailSendReceipt.serverMessage}
                </p>
              )}

              {Object.keys(emailSendReceipt.variables).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Dynamic fields sent</p>
                  <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
                    <ul className="divide-y divide-border/40 text-xs">
                      {Object.entries(emailSendReceipt.variables).map(([key, val]) => (
                        <li key={key} className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                          <span className="font-medium text-muted-foreground shrink-0 sm:w-32">{humanizeTemplateVarKey(key)}</span>
                          <span className={`font-mono break-all ${/password/i.test(key) ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
                            {val?.trim() ? val : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="px-3.5 py-2 text-[10px] text-muted-foreground border-t border-border/40 bg-muted/10">
                      For your verification only — these values match what was merged into the email.
                    </p>
                  </div>
                </div>
              )}

              {emailSendReceipt.attachmentNames.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Attachments</p>
                  <ul className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-xs space-y-1">
                    {emailSendReceipt.attachmentNames.map((name) => (
                      <li key={name} className="flex items-center gap-2 font-medium">
                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-primary" />
                        <span className="truncate">{name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Message preview (as sent)</p>
                <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-border/40 bg-muted/25">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Subject · </span>
                    <span className="text-xs font-semibold text-foreground">
                      <EmailBodyPreview text={emailSendReceipt.subject} vars={emailSendReceipt.variables} />
                    </span>
                  </div>
                  <div className="px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/85 max-h-48 overflow-y-auto">
                    <EmailBodyPreview text={emailSendReceipt.body} vars={emailSendReceipt.variables} />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border/50 shrink-0 bg-muted/10">
              <Button type="button" className="w-full sm:w-auto rounded-xl" onClick={() => setEmailSendReceipt(null)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

/* ── shared sub-components ───────────────────────────────────────────────────── */

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-1 h-4 rounded-full bg-primary" />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
      <SectionLabel title={title} />
      {children}
    </div>
  );
}

function TriggerCard({
  icon, title, topLabel, topSlot, bottomLabel, bottomSlot, button,
}: {
  icon: React.ReactNode;
  title: string;
  topLabel: string;
  topSlot: React.ReactNode;
  bottomLabel: string;
  bottomSlot: React.ReactNode;
  button: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{topLabel}</p>
        {topSlot}
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{bottomLabel}</p>
        {bottomSlot}
      </div>
      {button}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, dot }: { label: string; checked: boolean; onChange: (v: boolean) => void; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${checked ? dot : 'bg-muted-foreground/30'}`} />
        <span className="text-sm">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* ── EmailBodyPreview ─────────────────────────────────────────────────────── */
function EmailBodyPreview({ text, vars }: { text: string; vars: Record<string, string> }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const varName = m[1];
    const filled = vars[varName]?.trim();
    parts.push(
      filled
        ? <span key={key++} className="text-emerald-400 font-semibold">{filled}</span>
        : <span key={key++} className="text-rose-400 font-semibold bg-rose-500/10 rounded px-0.5">{`{{${varName}}}`}</span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

function TemplateSection({
  title, subtitle, onAdd, names, templates, editingIdx, editBuf, setEditBuf,
  onStartEdit, onCommitEdit, onCancelEdit, onRemove,
}: {
  title: string;
  subtitle: string;
  onAdd: () => void;
  names: string[];
  templates: string[];
  editingIdx: number | null;
  editBuf: { name: string; msg: string };
  setEditBuf: React.Dispatch<React.SetStateAction<{ name: string; msg: string }>>;
  onStartEdit: (i: number) => void;
  onCommitEdit: (i: number) => void;
  onCancelEdit: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-8 rounded-lg flex-shrink-0" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" /> Add Template
        </Button>
      </div>

      {/* Table */}
      <div className="w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20">
              <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-5 py-2.5 w-44">Template Name</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2.5">Message Preview</th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-5 py-2.5 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                {editingIdx === i ? (
                  <>
                    <td className="px-5 py-3 align-top">
                      <Input
                        value={editBuf.name}
                        onChange={(e) => setEditBuf((b) => ({ ...b, name: e.target.value }))}
                        className="h-8 text-xs bg-muted/30 border-border/60 rounded-lg"
                        placeholder="Template name"
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Textarea
                        value={editBuf.msg}
                        onChange={(e) => setEditBuf((b) => ({ ...b, msg: e.target.value }))}
                        rows={2}
                        className="text-xs bg-muted/30 border-border/60 rounded-lg resize-none"
                      />
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onCommitEdit(i)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 font-medium text-sm align-middle">
                      {names[i] ?? `Template #${i + 1}`}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs align-middle max-w-0">
                      <p className="truncate">{tpl}</p>
                    </td>
                    <td className="px-5 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onStartEdit(i)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(i)}
                          disabled={templates.length <= 1}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
