import mongoose from 'mongoose';
import {
  User,
  Employee,
  AttendanceRecord,
  LeaveRequest,
  RegularizationRequest,
  LeaveBalance,
  PayrollRecord,
  GeneratedDocument,
  Automation,
  AttendanceSettings,
} from '../models.js';

async function authUserDoc(userId) {
  if (!mongoose.isValidObjectId(userId)) return null;
  return User.findById(userId).lean();
}

function selfServiceRole(role) {
  return role === 'employee' || role === 'freelancer_intern';
}

function linkedEmployeeId(u) {
  return u?.employeeId ? String(u.employeeId) : '';
}

function idOf(doc) {
  return doc._id.toString();
}

function serializeAttendance(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    employeeId: o.employeeId != null ? String(o.employeeId) : '',
    date: o.date,
    status: o.status,
    clockIn: o.clockIn || undefined,
    clockOut: o.clockOut || undefined,
    ipAddress: o.ipAddress || undefined,
    totalHours: o.totalHours,
  };
}

function serializeLeave(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: idOf(doc),
    employeeId: o.employeeId,
    leaveType: o.leaveType,
    fromDate: o.fromDate,
    toDate: o.toDate,
    days: o.days,
    reason: o.reason,
    status: o.status,
    note: o.note || undefined,
    approvedBy: o.approvedBy || undefined,
    approvedByName: o.approvedByName || undefined,
    createdAt: o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '',
  };
}

function serializeRegularization(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: idOf(doc),
    employeeId: o.employeeId,
    date: o.date,
    requestedStatus: o.requestedStatus || '',
    requestedClockIn: o.requestedClockIn || '',
    requestedClockOut: o.requestedClockOut || '',
    reason: o.reason || '',
    status: o.status || 'Pending',
    note: o.note || undefined,
    approvedBy: o.approvedBy || undefined,
    approvedByName: o.approvedByName || undefined,
    createdAt: o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '',
  };
}

function toMinutes(t) {
  if (!t || !/^\d{2}:\d{2}$/.test(String(t))) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function serializeBalance(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    employeeId: o.employeeId,
    annual: o.annual,
    sick: o.sick,
    casual: o.casual,
  };
}

function serializePayroll(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: idOf(doc),
    employeeId: o.employeeId,
    month: o.month,
    year: o.year,
    baseSalary: o.baseSalary,
    leaveDeductions: o.leaveDeductions,
    bonus: o.bonus,
    netPayable: o.netPayable,
    status: o.status,
  };
}

function serializeDocument(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: idOf(doc),
    name: o.name,
    type: o.type,
    linkedTo: o.linkedTo,
    linkedType: o.linkedType,
    date: o.date,
    content: o.content || undefined,
  };
}

function serializeAutomation(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: idOf(doc),
    name: o.name,
    description: o.description,
    active: o.active,
    lastTriggered: o.lastTriggered || undefined,
  };
}

function serializeSettings(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    ipRestrictionEnabled: o.ipRestrictionEnabled,
    allowedIPs: o.allowedIPs || [],
    autoMarkAbsent: o.autoMarkAbsent,
    halfDayThresholdHours: o.halfDayThresholdHours,
    fullDayThresholdHours: o.fullDayThresholdHours,
  };
}

async function getOrCreateSettings() {
  let s = await AttendanceSettings.findOne();
  if (!s) s = await AttendanceSettings.create({});
  return s;
}

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authMiddleware
 */
export function registerHrDataRoutes(app, authMiddleware) {
  /* ---------- Attendance ---------- */
  app.get('/api/attendance-records', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const q = {};
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.json([]);
        q.employeeId = eid;
      }
      const list = await AttendanceRecord.find(q).sort({ updatedAt: -1 }).limit(10000).exec();
      res.json(list.map(serializeAttendance));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to list attendance' });
    }
  });

  app.post('/api/attendance-records', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const body = req.body || {};
      let employeeId = body.employeeId;
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.status(403).json({ error: 'No employee profile linked to this account' });
        if (body.employeeId && String(body.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
        employeeId = eid;
      }
      const doc = await AttendanceRecord.create({
        employeeId,
        date: body.date,
        status: body.status,
        clockIn: body.clockIn,
        clockOut: body.clockOut,
        ipAddress: body.ipAddress,
        totalHours: body.totalHours,
      });
      res.status(201).json(serializeAttendance(doc));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Failed' });
    }
  });

  app.post('/api/attendance-records/bulk', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const { records } = req.body || {};
      if (!Array.isArray(records)) return res.status(400).json({ error: 'records array required' });
      let rows = records;
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.status(403).json({ error: 'No employee profile linked to this account' });
        for (const r of records) {
          if (r.employeeId && String(r.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
        }
        rows = records.map((r) => ({ ...r, employeeId: eid }));
      }
      for (const r of rows) {
        const set = {
          status: r.status,
          clockIn: r.clockIn || '',
          clockOut: r.clockOut || '',
          ipAddress: r.ipAddress || '',
        };
        if (r.totalHours !== undefined && r.totalHours !== null) set.totalHours = r.totalHours;
        await AttendanceRecord.findOneAndUpdate(
          { employeeId: r.employeeId, date: r.date },
          { $set: set },
          { upsert: true, new: true }
        );
      }
      res.json({ ok: true, count: rows.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Failed' });
    }
  });

  app.delete('/api/attendance-records', authMiddleware, async (req, res) => {
    try {
      const { employeeId, date } = req.query;
      const u = await authUserDoc(req.auth.userId);
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!employeeId || String(employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
      }
      if (employeeId && date) {
        await AttendanceRecord.deleteOne({ employeeId, date });
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  /* ---------- Leave ---------- */
  app.get('/api/leave-requests', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const q = {};
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.json([]);
        q.employeeId = eid;
      }
      const list = await LeaveRequest.find(q).sort({ createdAt: -1 }).limit(5000).exec();
      res.json(list.map(serializeLeave));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.post('/api/leave-requests', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const b = req.body || {};
      let employeeId = b.employeeId;
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.status(403).json({ error: 'No employee profile linked to this account' });
        if (b.employeeId && String(b.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
        employeeId = eid;
      }
      const doc = await LeaveRequest.create({
        employeeId,
        leaveType: b.leaveType,
        fromDate: b.fromDate,
        toDate: b.toDate,
        days: Number(b.days) || 0,
        reason: b.reason || '',
        status: b.status || 'Pending',
      });
      res.status(201).json(serializeLeave(doc));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed' });
    }
  });

  app.patch('/api/leave-requests/:id', authMiddleware, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const doc = await LeaveRequest.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      const u = await authUserDoc(req.auth.userId);
      const b = req.body || {};
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (String(doc.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
        if (b.status !== undefined || b.approvedBy !== undefined || b.approvedByName !== undefined) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
      if (b.status !== undefined) doc.status = b.status;
      if (b.note !== undefined) doc.note = b.note;
      if (b.approvedBy !== undefined) doc.approvedBy = b.approvedBy;
      if (b.approvedByName !== undefined) doc.approvedByName = b.approvedByName;
      await doc.save();
      res.json(serializeLeave(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  /* ---------- Regularization ---------- */
  app.get('/api/regularization-requests', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const q = {};
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.json([]);
        q.employeeId = eid;
      }
      const list = await RegularizationRequest.find(q).sort({ createdAt: -1 }).limit(5000).exec();
      res.json(list.map(serializeRegularization));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.post('/api/regularization-requests', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const b = req.body || {};
      let employeeId = b.employeeId;
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.status(403).json({ error: 'No employee profile linked to this account' });
        if (b.employeeId && String(b.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
        employeeId = eid;
      }
      if (!employeeId || !b.date || !String(b.reason || '').trim()) {
        return res.status(400).json({ error: 'employeeId, date and reason are required' });
      }
      const doc = await RegularizationRequest.create({
        employeeId,
        date: b.date,
        requestedStatus: b.requestedStatus || '',
        requestedClockIn: b.requestedClockIn || '',
        requestedClockOut: b.requestedClockOut || '',
        reason: String(b.reason || '').trim(),
        status: 'Pending',
      });
      res.status(201).json(serializeRegularization(doc));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed' });
    }
  });

  app.patch('/api/regularization-requests/:id', authMiddleware, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const doc = await RegularizationRequest.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      const u = await authUserDoc(req.auth.userId);
      const b = req.body || {};

      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (String(doc.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
        if (b.status !== undefined || b.approvedBy !== undefined || b.approvedByName !== undefined) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        if (doc.status !== 'Pending') return res.status(400).json({ error: 'Only pending requests can be edited' });
      }

      if (b.date !== undefined) doc.date = b.date;
      if (b.requestedStatus !== undefined) doc.requestedStatus = b.requestedStatus;
      if (b.requestedClockIn !== undefined) doc.requestedClockIn = b.requestedClockIn;
      if (b.requestedClockOut !== undefined) doc.requestedClockOut = b.requestedClockOut;
      if (b.reason !== undefined) doc.reason = b.reason;
      if (b.status !== undefined) doc.status = b.status;
      if (b.note !== undefined) doc.note = b.note;
      if (b.approvedBy !== undefined) doc.approvedBy = b.approvedBy;
      if (b.approvedByName !== undefined) doc.approvedByName = b.approvedByName;
      await doc.save();

      if (b.status === 'Approved') {
        const current = await AttendanceRecord.findOne({ employeeId: doc.employeeId, date: doc.date });
        const clockIn = doc.requestedClockIn || current?.clockIn || '';
        const clockOut = doc.requestedClockOut || current?.clockOut || '';
        const inMin = toMinutes(clockIn);
        const outMin = toMinutes(clockOut);
        const totalHours = inMin != null && outMin != null && outMin >= inMin
          ? Number(((outMin - inMin) / 60).toFixed(2))
          : current?.totalHours;

        await AttendanceRecord.findOneAndUpdate(
          { employeeId: doc.employeeId, date: doc.date },
          {
            $set: {
              status: doc.requestedStatus || current?.status || 'P',
              clockIn,
              clockOut,
              totalHours,
            },
          },
          { upsert: true, new: true }
        );
      }

      res.json(serializeRegularization(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.get('/api/leave-balances', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const q = {};
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.json([]);
        q.employeeId = eid;
      }
      const list = await LeaveBalance.find(q).exec();
      res.json(list.map(serializeBalance));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.put('/api/leave-balances/:employeeId', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (String(req.params.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
      }
      const doc = await LeaveBalance.findOneAndUpdate(
        { employeeId: req.params.employeeId },
        { $set: req.body || {} },
        { upsert: true, new: true }
      );
      res.json(serializeBalance(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  /* ---------- Payroll ---------- */
  app.get('/api/payroll-records/:id', authMiddleware, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const doc = await PayrollRecord.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      const u = await authUserDoc(req.auth.userId);
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (String(doc.employeeId) !== eid) return res.status(403).json({ error: 'Forbidden' });
      }
      res.json(serializePayroll(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.get('/api/payroll-records', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const { month, year } = req.query;
      const q = {};
      if (month) q.month = month;
      if (year !== undefined) q.year = Number(year);
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.json([]);
        q.employeeId = eid;
      }
      const list = await PayrollRecord.find(q).sort({ updatedAt: -1 }).limit(5000).exec();
      res.json(list.map(serializePayroll));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.post('/api/payroll-records', authMiddleware, async (req, res) => {
    try {
      const b = req.body || {};
      const doc = await PayrollRecord.create({
        employeeId: b.employeeId,
        month: b.month,
        year: Number(b.year),
        baseSalary: Number(b.baseSalary),
        leaveDeductions: Number(b.leaveDeductions) || 0,
        bonus: Number(b.bonus) || 0,
        netPayable: Number(b.netPayable),
        status: b.status || 'Unpaid',
      });
      res.status(201).json(serializePayroll(doc));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed' });
    }
  });

  app.post('/api/payroll-records/bulk-upsert', authMiddleware, async (req, res) => {
    try {
      const { records } = req.body || {};
      if (!Array.isArray(records)) return res.status(400).json({ error: 'records required' });
      const out = [];
      for (const r of records) {
        const doc = await PayrollRecord.findOneAndUpdate(
          { employeeId: r.employeeId, month: r.month, year: Number(r.year) },
          {
            $set: {
              baseSalary: Number(r.baseSalary),
              leaveDeductions: Number(r.leaveDeductions) || 0,
              bonus: Number(r.bonus) || 0,
              netPayable: Number(r.netPayable),
              status: r.status || 'Unpaid',
            },
          },
          { upsert: true, new: true }
        );
        out.push(serializePayroll(doc));
      }
      res.json(out);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Failed' });
    }
  });

  app.patch('/api/payroll-records/:id', authMiddleware, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const doc = await PayrollRecord.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      Object.assign(doc, req.body || {});
      await doc.save();
      res.json(serializePayroll(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.patch('/api/payroll-records', authMiddleware, async (req, res) => {
    try {
      const { month, year, status } = req.body || {};
      if (!month || year === undefined) return res.status(400).json({ error: 'month and year required' });
      await PayrollRecord.updateMany({ month, year: Number(year), status: 'Unpaid' }, { $set: { status: status || 'Paid' } });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  /* ---------- Documents ---------- */
  app.get('/api/generated-documents', authMiddleware, async (req, res) => {
    try {
      const u = await authUserDoc(req.auth.userId);
      const q = {};
      if (u && selfServiceRole(u.app_role)) {
        const eid = linkedEmployeeId(u);
        if (!eid) return res.json([]);
        const emp = await Employee.findById(eid).select('fullName').lean();
        const name = emp?.fullName || '';
        q['$or'] = [{ linkedTo: eid }, ...(name ? [{ linkedTo: name }] : [])];
      }
      const list = await GeneratedDocument.find(q).sort({ updatedAt: -1 }).limit(2000).exec();
      res.json(list.map(serializeDocument));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.post('/api/generated-documents', authMiddleware, async (req, res) => {
    try {
      const b = req.body || {};
      const doc = await GeneratedDocument.create({
        name: b.name,
        type: b.type,
        linkedTo: b.linkedTo || '',
        linkedType: b.linkedType || 'Employee',
        date: b.date,
        content: b.content || '',
      });
      res.status(201).json(serializeDocument(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.delete('/api/generated-documents/:id', authMiddleware, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const r = await GeneratedDocument.deleteOne({ _id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  /* ---------- Automations ---------- */
  app.get('/api/automations', authMiddleware, async (_req, res) => {
    try {
      const list = await Automation.find().sort({ name: 1 }).exec();
      res.json(list.map(serializeAutomation));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.post('/api/automations', authMiddleware, async (req, res) => {
    try {
      const b = req.body || {};
      const doc = await Automation.create({
        name: b.name,
        description: b.description || '',
        active: b.active !== false,
        lastTriggered: b.lastTriggered || '',
      });
      res.status(201).json(serializeAutomation(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.patch('/api/automations/:id', authMiddleware, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const doc = await Automation.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      Object.assign(doc, req.body || {});
      await doc.save();
      res.json(serializeAutomation(doc));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  /* ---------- Attendance settings (singleton) ---------- */
  app.get('/api/settings/attendance', authMiddleware, async (_req, res) => {
    try {
      const s = await getOrCreateSettings();
      res.json(serializeSettings(s));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.put('/api/settings/attendance', authMiddleware, async (_req, res) => {
    try {
      const b = req.body || {};
      const s = await getOrCreateSettings();
      if (b.ipRestrictionEnabled !== undefined) s.ipRestrictionEnabled = b.ipRestrictionEnabled;
      if (b.allowedIPs !== undefined) s.allowedIPs = b.allowedIPs;
      if (b.autoMarkAbsent !== undefined) s.autoMarkAbsent = b.autoMarkAbsent;
      if (b.halfDayThresholdHours !== undefined) s.halfDayThresholdHours = b.halfDayThresholdHours;
      if (b.fullDayThresholdHours !== undefined) s.fullDayThresholdHours = b.fullDayThresholdHours;
      await s.save();
      res.json(serializeSettings(s));
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });
}
