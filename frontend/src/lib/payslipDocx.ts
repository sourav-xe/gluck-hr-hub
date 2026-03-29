import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EmployeeLike = {
  id: string;
  employeeCode?: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  joiningDate: string;
  address: string;
  passportNumber: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  nationality: string;
  reportingManagerId?: string;
};

export type PayrollRecordLike = {
  id: string;
  month: string;
  year: number;
  baseSalary: number;
  leaveDeductions: number;
  bonus: number;
  netPayable: number;
};

export type AttendanceLike = {
  employeeId: string;
  date: string; // dd/mm/yyyy
  status: string;
};

export type LeaveLike = {
  employeeId: string;
  leaveType: string;
  fromDate: string; // dd/mm/yyyy
  days: number;
  status: string;
};

export type PayslipDays = {
  totalDays: number;
  presentDays: number;
  leaveDays: number;
  halfDayDays: number;
  paidDays: number;
  absentDays: number;
  unpaidLeaveDays: number;
  lossOfPayDays: number;
};

// ─── XML helpers ────────────────────────────────────────────────────────────

function decodeXml(s: string): string {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function encodeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getRunText(runXml: string): string {
  const parts: string[] = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(runXml)) !== null) parts.push(decodeXml(m[1]));
  return parts.join('');
}

const RED_COLOR_RE =
  /FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000/;

function isRedRun(runXml: string): boolean {
  const m = runXml.match(/<w:color\b[^>]*w:val=["']([^"']+)["'][^>]*\/?>/i);
  if (!m) return false;
  const val = m[1].toUpperCase();
  if (RED_COLOR_RE.test(val)) return true;
  // Custom: R > 180, G < 100, B < 100
  if (/^[0-9A-F]{6}$/.test(val)) {
    const r = parseInt(val.slice(0, 2), 16);
    const g = parseInt(val.slice(2, 4), 16);
    const b = parseInt(val.slice(4, 6), 16);
    if (r > 180 && g < 100 && b < 100) return true;
  }
  return false;
}

function setRunText(runXml: string, newText: string): string {
  // Colour → black
  let result = runXml.replace(
    /<w:color\s+w:val=["'][^"']+["']\s*\/>/gi,
    '<w:color w:val="000000"/>'
  );
  // Replace all <w:t> nodes with one carrying the new value
  const enc = encodeXml(newText);
  let first = true;
  result = result.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, () => {
    if (!first) return '';
    first = false;
    return `<w:t xml:space="preserve">${enc}</w:t>`;
  });
  return result;
}

// ─── Number → words ─────────────────────────────────────────────────────────

function numToWords(n: number): string {
  const num = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tensW = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const two = (x: number): string => {
    if (x === 0) return '';
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10), r = x % 10;
    return r === 0 ? tensW[t] : `${tensW[t]} ${ones[r]}`;
  };

  const three = (x: number): string => {
    if (x === 0) return '';
    if (x < 100) return two(x);
    const h = Math.floor(x / 100), r = x % 100;
    return r === 0 ? `${ones[h]} Hundred` : `${ones[h]} Hundred and ${two(r)}`;
  };

  const parts: string[] = [];
  const mil = Math.floor(num / 1_000_000);
  const thou = Math.floor((num % 1_000_000) / 1_000);
  const rem = num % 1_000;

  if (mil > 0) parts.push(`${three(mil)} Million`);
  if (thou > 0) parts.push(`${three(thou)} Thousand`);
  if (rem > 0) parts.push(three(rem));

  return parts.join(' ');
}

function lkrInWords(n: number): string {
  return `Rupees ${numToWords(n)} Only.`;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString('en-LK') : '0';
}

function fmtDays(n: number, zeroAs00 = false): string {
  if (!Number.isFinite(n) || n === 0) return zeroAs00 ? '00' : '';
  return String(n);
}

// ─── Context-based value inference ──────────────────────────────────────────
// `ctx` = all non-red text accumulated in the current table row BEFORE this run.
// This covers both "label: [value]" in the same cell AND "label | [value]"
// where label is in the left cell and the value is in the right cell.

function inferValue(
  ctx: string,
  orig: string,
  emp: EmployeeLike,
  record: PayrollRecordLike,
  days: PayslipDays
): string {
  // Use the tail of the accumulated context (last ~300 chars is enough)
  const tail = ctx.slice(-300);
  const m = (re: RegExp) => re.test(tail);
  const tailLower = tail.toLowerCase();

  const detectNearestLabel = (): string | null => {
    const labelChecks: Array<{ key: string; re: RegExp }> = [
      { key: 'emp_name', re: /emp(?:loyee)?\s*name/gi },
      { key: 'employee_id', re: /employee\s*(?:id|no|number|#)?/gi },
      { key: 'department', re: /department/gi },
      { key: 'national_card', re: /(national\s*(?:card|id)|\bnic\b)/gi },
      { key: 'designation', re: /designation/gi },
      { key: 'joining_date', re: /joining\s*(?:date)?/gi },
      { key: 'state', re: /\bstate\b/gi },
      { key: 'bank_name', re: /bank\s*name/gi },
      { key: 'account_no', re: /(account\s*(?:no|number)|acct\s*no|a\/c)/gi },
      { key: 'basic', re: /\bbasic\b/gi },
      { key: 'incentive', re: /(incentive|bonus)/gi },
      { key: 'earning', re: /\bearning\b/gi },
      { key: 'deduction', re: /\bdeduction\b/gi },
      { key: 'net_salary', re: /net\s*(?:salary|wages|payable)/gi },
      { key: 'total_days', re: /total\s*days/gi },
      { key: 'present_days', re: /present\s*days/gi },
      { key: 'leave', re: /\bleave\b/gi },
      { key: 'half_day', re: /half\s*day/gi },
      { key: 'paid_days', re: /paid\s*days/gi },
      { key: 'loss_of_pay', re: /loss\s*of\s*pay/gi },
    ];

    const lastMatchIdx = (text: string, re: RegExp): number => {
      let last = -1;
      let match: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((match = re.exec(text)) !== null) {
        last = match.index;
        if (match.index === re.lastIndex) re.lastIndex += 1;
      }
      return last;
    };

    let bestKey: string | null = null;
    let bestIdx = -1;
    for (const lc of labelChecks) {
      const idx = lastMatchIdx(tailLower, lc.re);
      if (idx >= 0 && idx >= bestIdx) {
        bestIdx = idx;
        bestKey = lc.key;
      }
    }
    return bestKey;
  };

  // ── Identity ──
  if (m(/emp(?:loyee)?\s*name\s*[:\s]*$/i)) return emp.fullName;
  if (m(/employee\s*(?:id|no|number|#)?\s*[:\s]*$/i)) return emp.employeeCode || emp.id;
  if (m(/department\s*[:\s]*$/i)) return emp.department;
  if (m(/designation\s*[:\s]*$/i)) return emp.jobTitle;
  if (m(/joining\s*(?:date)?\s*[:\s]*$/i)) return emp.joiningDate;
  if (m(/\bstate\s*[:\s]*$/i)) return emp.address;
  if (m(/(national\s*(?:card|id)|nic)\s*[:\s]*$/i)) return emp.passportNumber || emp.nationality || '';
  if (m(/bank\s*name\s*[:\s]*$/i)) return emp.bankName;
  if (m(/(account\s*(?:no|number)|acct\s*no|a\/c)\s*[:\s]*$/i)) return emp.accountNumber;
  if (m(/account\s*holder\s*[:\s]*$/i)) return emp.accountHolderName;

  // ── Month/year ──
  if (m(/payslip\s+for\s+(?:month\s+of\s+)?$/i)) return `${record.month} ${record.year}`;
  if (m(/for\s+month\s+of\s+$/i)) return `${record.month} ${record.year}`;

  // ── Salary (numbers without LKR prefix; template uses plain numbers) ──
  if (m(/\bbasic\s*$/i)) return fmt(record.baseSalary);
  if (m(/rate\s*of\s*salary\s*$/i)) return fmt(record.baseSalary);
  if (m(/(incentive|bonus)\s*$/i)) return fmt(record.bonus);
  if (m(/\bearning\s*$/i)) return fmt(record.baseSalary);
  if (m(/\bdeduction\s*$/i)) return fmt(record.leaveDeductions);
  if (m(/net\s*(?:salary|wages|payable)\s*$/i)) return fmt(record.netPayable);

  // ── Amount in words – check full context for the label ──
  if (/in\s*words/i.test(ctx)) return lkrInWords(record.netPayable);

  // ── Attendance / leave ──
  if (m(/total\s*days\s*$/i)) return fmtDays(days.totalDays);
  if (m(/present\s*days\s*$/i)) return fmtDays(days.presentDays);
  if (m(/\bleave\s*$/i) && !m(/loss\s*of/i)) return fmtDays(days.leaveDays, true);
  if (m(/half\s*day\s*$/i)) return fmtDays(days.halfDayDays, true);
  if (m(/paid\s*days\s*$/i)) return fmtDays(days.paidDays);
  if (m(/loss\s*of\s*pay\s*$/i)) return fmtDays(days.lossOfPayDays);
  if (m(/absent\s*days?\s*$/i)) return fmtDays(days.absentDays);

  // ── Fallback: nearest preceding label in this row/paragraph ──
  const nearest = detectNearestLabel();
  switch (nearest) {
    case 'emp_name': return emp.fullName;
    case 'employee_id': return emp.employeeCode || emp.id;
    case 'department': return emp.department;
    case 'national_card': return emp.passportNumber || emp.nationality || '';
    case 'designation': return emp.jobTitle;
    case 'joining_date': return emp.joiningDate;
    case 'state': return emp.address;
    case 'bank_name': return emp.bankName;
    case 'account_no': return emp.accountNumber;
    case 'basic': return fmt(record.baseSalary);
    case 'incentive': return fmt(record.bonus);
    case 'earning': return fmt(record.baseSalary);
    case 'deduction': return fmt(record.leaveDeductions);
    case 'net_salary': return fmt(record.netPayable);
    case 'total_days': return fmtDays(days.totalDays);
    case 'present_days': return fmtDays(days.presentDays);
    case 'leave': return fmtDays(days.leaveDays, true);
    case 'half_day': return fmtDays(days.halfDayDays, true);
    case 'paid_days': return fmtDays(days.paidDays);
    case 'loss_of_pay': return fmtDays(days.lossOfPayDays);
    default:
      // Never leak sample template red values into generated docs.
      return '';
  }
}

// ─── Main XML processor ─────────────────────────────────────────────────────

function processSequentially(
  xmlChunk: string,
  emp: EmployeeLike,
  record: PayrollRecordLike,
  days: PayslipDays
): string {
  const inferIdentityLabelKey = (ctxText: string): string | null => {
    const tail = ctxText.slice(-300).toLowerCase();
    const checks: Array<{ key: string; re: RegExp }> = [
      { key: 'emp_name', re: /emp(?:loyee)?\s*name/gi },
      { key: 'employee_id', re: /employee\s*(?:id|no|number|#)?/gi },
      { key: 'department', re: /department/gi },
      { key: 'national_card', re: /(national\s*(?:card|id)|\bnic\b)/gi },
      { key: 'designation', re: /designation/gi },
      { key: 'joining_date', re: /joining\s*(?:date)?/gi },
      { key: 'state', re: /\bstate\b/gi },
      { key: 'bank_name', re: /bank\s*name/gi },
      { key: 'account_no', re: /(account\s*(?:no|number)|acct\s*no|a\/c)/gi },
    ];
    const lastIdx = (re: RegExp): number => {
      let idx = -1;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(tail)) !== null) {
        idx = m.index;
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
      return idx;
    };
    let bestKey: string | null = null;
    let best = -1;
    for (const c of checks) {
      const i = lastIdx(c.re);
      if (i >= 0 && i >= best) {
        best = i;
        bestKey = c.key;
      }
    }
    return bestKey;
  };

  const smartSpace = (ctxText: string, originalRed: string, replaced: string): string => {
    let out = String(replaced || '');
    if (!out) return out;

    const prev = ctxText.slice(-1);
    const needsPrefix =
      !!prev &&
      /[A-Za-z0-9)]/.test(prev) &&
      /^[A-Za-z0-9(]/.test(out) &&
      !out.startsWith(' ');
    if (needsPrefix) out = ` ${out}`;

    // Keep author-intended spacing from the original red run when available.
    if (/^\s/.test(originalRed) && !out.startsWith(' ')) out = ` ${out}`;
    if (/\s$/.test(originalRed) && !out.endsWith(' ')) out = `${out} `;

    // For text-like values, ensure a trailing gap so next static label doesn't stick.
    if (/[A-Za-z]/.test(out) && /[A-Za-z0-9]$/.test(out) && !out.endsWith(' ')) {
      out = `${out} `;
    }
    return out;
  };

  // Process all runs in order, accumulating preceding text as context.
  let ctx = '';
  let prevRunWasRed = false;
  let prevRedValue = '';
  const identityFilledInChunk = new Set<string>();
  return xmlChunk.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    const text = getRunText(run);
    if (isRedRun(run) && text.trim()) {
      const identityKey = inferIdentityLabelKey(ctx);
      let val = inferValue(ctx, text, emp, record, days);
      // If this identity label already got a value in this row/paragraph, skip repeats.
      if (identityKey && identityFilledInChunk.has(identityKey)) {
        val = '';
      }
      // If two adjacent red runs resolve to the same value (with no real text between),
      // keep only one to avoid duplicated output like "SouravSourav".
      if (prevRunWasRed && prevRedValue && val === prevRedValue) {
        val = '';
      }
      val = smartSpace(ctx, text, val);
      ctx += val; // add the *replacement* to ctx so later runs see it
      if (identityKey && val.trim()) identityFilledInChunk.add(identityKey);
      prevRunWasRed = true;
      prevRedValue = val || prevRedValue;
      return setRunText(run, val);
    }
    ctx += text;
    if (text.trim()) {
      prevRunWasRed = false;
      prevRedValue = '';
    }
    return run;
  });
}

function processPayslipXml(
  xml: string,
  emp: EmployeeLike,
  record: PayrollRecordLike,
  days: PayslipDays
): string {
  // ── Step 1: process each table row with row-level accumulated context ──
  // This handles both same-cell (label + value) and cross-cell (label | value) layouts.
  const step1 = xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, (row) =>
    processSequentially(row, emp, record, days)
  );

  // ── Step 2: process remaining standalone paragraphs (e.g. "PAYSLIP FOR MONTH OF…") ──
  // Runs inside table rows are now black, so isRedRun() won't re-trigger them.
  const step2 = step1.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) =>
    processSequentially(para, emp, record, days)
  );

  return step2;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function computePayslipDaysForEmployee({
  employeeId,
  monthIndex,
  attendanceRecords,
  leaveRequests,
}: {
  employeeId: string;
  monthIndex: number;
  attendanceRecords: AttendanceLike[];
  leaveRequests: LeaveLike[];
}): PayslipDays {
  const atIdx = (date: string) => {
    const p = date.split('/').map(Number);
    return p[1] - 1; // dd/mm/yyyy → 0-based month
  };

  const empAtt = attendanceRecords.filter((a) => a.employeeId === employeeId);
  const presentDays  = empAtt.filter((a) => atIdx(a.date) === monthIndex && (a.status === 'P' || a.status === 'WFH')).length;
  const absentDays   = empAtt.filter((a) => atIdx(a.date) === monthIndex && a.status === 'A').length;
  const halfDayDays  = empAtt.filter((a) => atIdx(a.date) === monthIndex && a.status === 'HD').length;

  const empLeaves = leaveRequests.filter(
    (l) => l.employeeId === employeeId && l.status === 'Approved' && atIdx(l.fromDate) === monthIndex
  );
  const unpaidLeaveDays = empLeaves.filter((l) => l.leaveType === 'Unpaid').reduce((s, l) => s + (l.days || 0), 0);
  const paidLeaveDays   = empLeaves.filter((l) => l.leaveType !== 'Unpaid').reduce((s, l) => s + (l.days || 0), 0);

  const lossOfPayDays = absentDays + unpaidLeaveDays;
  const leaveDays     = paidLeaveDays;
  const totalDays     = presentDays + absentDays + halfDayDays + leaveDays + unpaidLeaveDays;
  const paidDays      = presentDays + leaveDays + halfDayDays;

  return { totalDays, presentDays, leaveDays, halfDayDays, paidDays, absentDays, unpaidLeaveDays, lossOfPayDays };
}

export async function generatePayslipFromTemplate({
  templateUrl,
  filename,
  emp,
  record,
  days,
}: {
  templateUrl: string;
  filename: string;
  emp: EmployeeLike;
  record: PayrollRecordLike;
  days: PayslipDays;
}): Promise<{ blobUrl: string; filename: string }> {
  // Load DOCX as ArrayBuffer
  let buf: ArrayBuffer;
  if (templateUrl.startsWith('data:')) {
    const base64 = templateUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    buf = bytes.buffer;
  } else {
    buf = await (await fetch(templateUrl)).arrayBuffer();
  }

  const zip = await JSZip.loadAsync(buf);

  const xmlParts = ['word/document.xml'];
  zip.forEach((p) => {
    if (/^word\/(header|footer)\d*\.xml$/.test(p)) xmlParts.push(p);
  });

  for (const part of xmlParts) {
    const content = await zip.file(part)?.async('string');
    if (content) zip.file(part, processPayslipXml(content, emp, record, days));
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, filename };
}

export function downloadBlob(blobUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}
