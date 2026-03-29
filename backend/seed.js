/**
 * Seed MongoDB with demo employees + super admin (+ optional automations).
 *
 * Usage:
 *   npm run seed              — add missing users/employees only (safe)
 *   npm run seed -- --reset   — DELETE all users & employees, then seed fresh
 *
 * Default password for every seeded account: GluckDemo123!
 * Override: SEED_PASSWORD="YourPass" npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Employee, Counter, Automation, DocumentTemplate, DocumentAutomationRun } from './models.js';
import { ensureSampleDocumentTemplates } from './documentAutomationRoutes.js';

const DEFAULT_AUTOMATIONS = [
  { name: 'Birthday Notifier', description: 'Daily check for employee birthdays, notify HR admin', active: true, lastTriggered: '' },
  { name: 'Welcome Message', description: 'Auto-draft welcome message when new employee added', active: true, lastTriggered: '' },
  { name: 'Pre-joining Reminder', description: '7 days before start date, remind HR to prepare', active: true, lastTriggered: '' },
  { name: 'Attendance Reminder', description: 'If attendance not marked by 10am, send reminder', active: false, lastTriggered: '' },
  { name: 'Timesheet Reminder', description: 'Last 3 days of month, notify employees to submit timesheets', active: true, lastTriggered: '' },
  { name: 'Salary Paid Notification', description: 'Auto email when Mark Paid is triggered', active: true, lastTriggered: '' },
  { name: 'Leave Approval Notification', description: 'Email employee when leave approved/rejected', active: true, lastTriggered: '' },
];

const MONGODB_URI = process.env.MONGODB_URI;
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'GluckDemo123!';
const RESET = process.argv.includes('--reset');

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}

/** Demo accounts for initial HR data */
const SUPER_ADMIN = {
  email: 'admin@gluckglobal.com',
  fullName: 'Admin User',
  app_role: 'super_admin',
};

const MOCK_EMPLOYEES = [
  {
    key: '1',
    fullName: 'Ashan Perera',
    email: 'ashan@gluckglobal.com',
    phone: '+94 77 123 4567',
    type: 'Full Time',
    department: 'Human Resources',
    jobTitle: 'HR Manager',
    reportingManagerKey: null,
    joiningDate: '01/01/2023',
    dateOfBirth: '15/03/1990',
    salaryType: 'Fixed Monthly',
    salaryAmount: 85000,
    bankName: 'Commercial Bank',
    accountNumber: '1234567890',
    accountHolderName: 'Ashan Perera',
    address: '45 Temple Road, Kandy',
    nationality: 'Sri Lankan',
    passportNumber: 'N1234567',
    status: 'Active',
    app_role: 'hr_manager',
  },
  {
    key: '2',
    fullName: 'Dilini Fernando',
    email: 'dilini@gluckglobal.com',
    phone: '+94 71 234 5678',
    type: 'Full Time',
    department: 'Recruitment',
    jobTitle: 'Recruiter',
    reportingManagerKey: '1',
    joiningDate: '15/03/2023',
    dateOfBirth: '22/07/1993',
    salaryType: 'Fixed Monthly',
    salaryAmount: 65000,
    bankName: 'Sampath Bank',
    accountNumber: '9876543210',
    accountHolderName: 'Dilini Fernando',
    address: '12 Lake View, Peradeniya',
    nationality: 'Sri Lankan',
    passportNumber: '',
    status: 'Active',
    app_role: 'employee',
  },
  {
    key: '3',
    fullName: 'Rajan Nair',
    email: 'rajan@gluckglobal.com',
    phone: '+94 76 345 6789',
    type: 'Freelancer',
    department: 'Training',
    jobTitle: 'Trainer/Tutor',
    reportingManagerKey: null,
    joiningDate: '01/06/2023',
    dateOfBirth: '08/11/1985',
    salaryType: 'Per Session',
    salaryAmount: 2500,
    bankName: 'HNB',
    accountNumber: '5555666677',
    accountHolderName: 'Rajan Nair',
    address: '78 Hill Street, Kandy',
    nationality: 'Indian',
    passportNumber: 'J8765432',
    status: 'Active',
    app_role: 'freelancer_intern',
  },
  {
    key: '4',
    fullName: 'Priya Jayasinghe',
    email: 'priya@gluckglobal.com',
    phone: '+94 72 456 7890',
    type: 'Full Time',
    department: 'Administration',
    jobTitle: 'Admin Executive',
    reportingManagerKey: '1',
    joiningDate: '01/06/2024',
    dateOfBirth: '30/12/1995',
    salaryType: 'Fixed Monthly',
    salaryAmount: 55000,
    bankName: 'BOC',
    accountNumber: '1111222233',
    accountHolderName: 'Priya Jayasinghe',
    address: '23 Dalada Veediya, Kandy',
    nationality: 'Sri Lankan',
    passportNumber: '',
    status: 'Active',
    app_role: 'employee',
  },
  {
    key: '5',
    fullName: 'Kasun Silva',
    email: 'kasun@gluckglobal.com',
    phone: '+94 78 567 8901',
    type: 'Intern',
    department: 'Human Resources',
    jobTitle: 'Intern',
    reportingManagerKey: '1',
    joiningDate: '01/01/2025',
    dateOfBirth: '25/06/2002',
    salaryType: 'Fixed Monthly',
    salaryAmount: 15000,
    bankName: "People's Bank",
    accountNumber: '4444555566',
    accountHolderName: 'Kasun Silva',
    address: '56 Katugastota Road, Kandy',
    nationality: 'Sri Lankan',
    passportNumber: '',
    status: 'Active',
    app_role: 'employee',
  },
];

async function main() {
  console.log('\n========== SEED (mock data → MongoDB) ==========');

  // MUST connect before any queries (reset used to run deleteMany before connect — broke --reset)
  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.db?.databaseName ?? '(unknown)';
  console.log('[seed] MongoDB connected');
  console.log('[seed] Active database name:', dbName);
  console.log('[seed] In Atlas UI: open this database → collections "users" and "employees" (lowercase)');

  if (RESET) {
    const du = await User.deleteMany({});
    const de = await Employee.deleteMany({});
    const da = await Automation.deleteMany({});
    const dtr = await DocumentTemplate.deleteMany({});
    const dru = await DocumentAutomationRun.deleteMany({});
    console.log(
      `[seed] --reset: removed ${du.deletedCount} users, ${de.deletedCount} employees, ${da.deletedCount} automations, ${dtr.deletedCount} doc templates, ${dru.deletedCount} doc runs`
    );
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Super admin (no employee row) — ensure email exists on upsert insert
  await User.findOneAndUpdate(
    { email: SUPER_ADMIN.email },
    {
      $set: {
        email: SUPER_ADMIN.email,
        passwordHash,
        fullName: SUPER_ADMIN.fullName,
        app_role: SUPER_ADMIN.app_role,
        employeeId: null,
      },
    },
    { upsert: true, new: true }
  );
  console.log('[seed] Super admin:', SUPER_ADMIN.email);

  const keyToEmployeeId = {};

  for (const row of MOCK_EMPLOYEES) {
    const { key, reportingManagerKey, app_role, ...empFields } = row;
    const doc = await Employee.findOneAndUpdate(
      { email: row.email },
      {
        $set: {
          ...empFields,
          passportNumber: empFields.passportNumber || '',
          reportingManagerId: '',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    keyToEmployeeId[key] = doc._id;
    console.log('[seed] Employee:', row.email, '→', doc._id.toString());
  }

  for (const row of MOCK_EMPLOYEES) {
    if (!row.reportingManagerKey || !keyToEmployeeId[row.key]) continue;
    const mgrId = keyToEmployeeId[row.reportingManagerKey];
    if (!mgrId) continue;
    await Employee.updateOne({ email: row.email }, { $set: { reportingManagerId: mgrId.toString() } });
  }

  for (const row of MOCK_EMPLOYEES) {
    const emp = await Employee.findOne({ email: row.email });
    if (!emp) continue;

    const user = await User.findOneAndUpdate(
      { email: row.email },
      {
        $set: {
          email: row.email,
          passwordHash,
          fullName: row.fullName,
          app_role: row.app_role,
          employeeId: emp._id,
        },
      },
      { upsert: true, new: true }
    );

    await Employee.updateOne({ _id: emp._id }, { $set: { userId: user._id } });
    console.log('[seed] User+link:', row.email, `(${row.app_role})`);
  }

  {
    let seq = (await Counter.findById('employeeCode').lean())?.seq || 0;
    let codesAssigned = false;
    for (let i = 0; i < MOCK_EMPLOYEES.length; i++) {
      const row = MOCK_EMPLOYEES[i];
      const emp = await Employee.findOne({ email: row.email }).select('employeeCode').lean();
      if (!emp || emp.employeeCode) continue;
      seq += 1;
      const code = `GG${String(seq).padStart(3, '0')}`;
      await Employee.updateOne({ email: row.email }, { $set: { employeeCode: code } });
      codesAssigned = true;
    }
    if (codesAssigned) {
      await Counter.findOneAndUpdate({ _id: 'employeeCode' }, { $set: { seq } }, { upsert: true });
    }
  }

  for (const row of DEFAULT_AUTOMATIONS) {
    await Automation.findOneAndUpdate(
      { name: row.name },
      { $set: row },
      { upsert: true, new: true }
    );
  }
  console.log('[seed] Automations:', DEFAULT_AUTOMATIONS.length, 'definitions ensured');

  const adminUser = await User.findOne({ email: SUPER_ADMIN.email }).lean();
  const docSeed = await ensureSampleDocumentTemplates(adminUser?._id ? String(adminUser._id) : '');
  console.log(
    '[seed] Document automation sample:',
    docSeed.created ? `created template ${docSeed.id}` : `already present (${docSeed.id})`
  );

  const userCount = await User.countDocuments();
  const empCount = await Employee.countDocuments();
  console.log('\n[seed] VERIFY counts: users =', userCount, '| employees =', empCount);
  if (userCount === 0) {
    console.error('[seed] WARNING: no users were written — check database name in URI (should be /hrms) and Atlas project.');
  }

  console.log('\n[seed] Done. Login password for ALL seeded accounts:', DEFAULT_PASSWORD);
  console.log('[seed] Super admin →', SUPER_ADMIN.email);
  console.log('[seed] Employees  → ashan@, dilini@, rajan@, priya@, kasun@ @gluckglobal.com');
  console.log('================================================\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed] Failed:', err.message || err);
  if (String(err.message || '').includes('whitelist') || err.name === 'MongooseServerSelectionError') {
    console.error('[seed] Atlas: Network Access → allow your IP (or 0.0.0.0/0 for dev).');
  }
  process.exit(1);
});
