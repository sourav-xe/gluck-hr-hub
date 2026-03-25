import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, default: '' },
    app_role: { type: String, default: 'employee' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  },
  { timestamps: true }
);

const onboardingDocumentSchema = new mongoose.Schema(
  {
    docType: { type: String, required: true },
    label: { type: String, default: '' },
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    data: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const employeeSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    type: { type: String, default: 'Full Time' },
    department: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    reportingManagerId: { type: String, default: '' },
    joiningDate: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    salaryType: { type: String, default: 'Fixed Monthly' },
    salaryAmount: { type: Number, default: 0 },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    address: { type: String, default: '' },
    permanentAddress: { type: String, default: '' },
    nationality: { type: String, default: '' },
    passportNumber: { type: String, default: '' },
    bloodGroup: { type: String, default: '' },
    maritalStatus: { type: String, default: '' },
    aadhaarNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    pfNumber: { type: String, default: '' },
    uanNumber: { type: String, default: '' },
    emergencyContactName: { type: String, default: '' },
    emergencyContactRelation: { type: String, default: '' },
    emergencyContactPhone: { type: String, default: '' },
    previousCompany: { type: String, default: '' },
    previousSalary: { type: String, default: '' },
    status: { type: String, default: 'Active' },
    avatar: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    onboardingComplete: { type: Boolean, default: null },
    onboardingStep: { type: Number, default: 0 },
    onboardingDocuments: { type: [onboardingDocumentSchema], default: () => [] },
  },
  { timestamps: true }
);

employeeSchema.index({ email: 1 });

const attendanceRecordSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    status: { type: String, required: true },
    clockIn: { type: String, default: '' },
    clockOut: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    totalHours: { type: Number, default: undefined },
  },
  { timestamps: true }
);
attendanceRecordSchema.index({ employeeId: 1, date: 1 });

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    leaveType: { type: String, required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: { type: String, default: 'Pending' },
    note: { type: String, default: '' },
    approvedBy: { type: String, default: '' },
    approvedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

const regularizationRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    requestedStatus: { type: String, default: '' },
    requestedClockIn: { type: String, default: '' },
    requestedClockOut: { type: String, default: '' },
    reason: { type: String, default: '' },
    status: { type: String, default: 'Pending' },
    note: { type: String, default: '' },
    approvedBy: { type: String, default: '' },
    approvedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    annual: { type: Number, default: 14 },
    sick: { type: Number, default: 7 },
    casual: { type: Number, default: 7 },
  },
  { timestamps: true }
);

const payrollRecordSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    baseSalary: { type: Number, required: true },
    leaveDeductions: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    netPayable: { type: Number, required: true },
    status: { type: String, default: 'Unpaid' },
  },
  { timestamps: true }
);
payrollRecordSchema.index({ employeeId: 1, month: 1, year: 1 });

const generatedDocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    linkedTo: { type: String, default: '' },
    linkedType: { type: String, default: 'Employee' },
    date: { type: String, required: true },
    content: { type: String, default: '' },
  },
  { timestamps: true }
);

const automationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    lastTriggered: { type: String, default: '' },
  },
  { timestamps: true }
);

const attendanceSettingsSchema = new mongoose.Schema(
  {
    ipRestrictionEnabled: { type: Boolean, default: false },
    allowedIPs: { type: [String], default: () => ['192.168.1.0/24'] },
    autoMarkAbsent: { type: Boolean, default: true },
    halfDayThresholdHours: { type: Number, default: 4 },
    fullDayThresholdHours: { type: Number, default: 8 },
  },
  { timestamps: true }
);

const docPlaceholderSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, default: '' },
    source: {
      type: String,
      enum: ['mustache', 'red', 'ai', 'manual', 'heuristic'],
      default: 'manual',
    },
    exampleValue: { type: String, default: '' },
    redSnippet: { type: String, default: '' },
  },
  { _id: false }
);

const documentTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'General' },
    status: { type: String, enum: ['draft', 'active'], default: 'draft' },
    templateKind: { type: String, enum: ['docx', 'pdf'], default: 'docx', index: true },
    storageDir: { type: String, required: true, index: true },
    originalFileName: { type: String, default: '' },
    placeholders: { type: [docPlaceholderSchema], default: () => [] },
    mappingsCommitted: { type: Boolean, default: false },
    lastDetectionAt: { type: Date },
    createdByUserId: { type: String, default: '' },
  },
  { timestamps: true }
);

const documentAutomationRunSchema = new mongoose.Schema(
  {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentTemplate', index: true },
    templateName: { type: String, required: true },
    employeeId: { type: String, default: '' },
    employeeName: { type: String, default: '' },
    values: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    docxRelativePath: { type: String, default: '' },
    pdfRelativePath: { type: String, default: '' },
    pdfError: { type: String, default: '' },
    createdByUserId: { type: String, default: '' },
  },
  { timestamps: true }
);

const announcementSettingsSchema = new mongoose.Schema(
  {
    birthdayTemplates: {
      type: [String],
      default: () => ['Happy Birthday {name}! 🎂 Wishing you a wonderful year ahead from the Gluck Global family.'],
    },
    festivalTemplates: {
      type: [String],
      default: () => ['Happy {festivalName}! ✨ Wishing everyone joy, health, and success.'],
    },
    birthdayTemplate: {
      type: String,
      default: 'Happy Birthday {name}! 🎂 Wishing you a wonderful year ahead from the Gluck Global family.',
    },
    festivalTemplate: {
      type: String,
      default: 'Happy {festivalName}! ✨ Wishing everyone joy, health, and success.',
    },
    festivalName: { type: String, default: '' },
    // Store as month-day (MM-DD) for recurring yearly trigger
    festivalMonthDay: { type: String, default: '' },
    autoBirthdayEnabled: { type: Boolean, default: true },
    autoFestivalEnabled: { type: Boolean, default: false },
    lastBirthdayRunOn: { type: String, default: '' }, // YYYY-MM-DD
    lastFestivalRunOn: { type: String, default: '' }, // YYYY-MM-DD
    lastBirthdayTemplateIndex: { type: Number, default: -1 },
    lastFestivalTemplateIndex: { type: Number, default: -1 },
    updatedByUserId: { type: String, default: '' },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);
export const AttendanceRecord = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', attendanceRecordSchema);
export const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);
export const RegularizationRequest = mongoose.models.RegularizationRequest || mongoose.model('RegularizationRequest', regularizationRequestSchema);
export const LeaveBalance = mongoose.models.LeaveBalance || mongoose.model('LeaveBalance', leaveBalanceSchema);
export const PayrollRecord = mongoose.models.PayrollRecord || mongoose.model('PayrollRecord', payrollRecordSchema);
export const GeneratedDocument = mongoose.models.GeneratedDocument || mongoose.model('GeneratedDocument', generatedDocumentSchema);
export const Automation = mongoose.models.Automation || mongoose.model('Automation', automationSchema);
export const AttendanceSettings = mongoose.models.AttendanceSettings || mongoose.model('AttendanceSettings', attendanceSettingsSchema);
export const AnnouncementSettings = mongoose.models.AnnouncementSettings || mongoose.model('AnnouncementSettings', announcementSettingsSchema);
export const DocumentTemplate =
  mongoose.models.DocumentTemplate || mongoose.model('DocumentTemplate', documentTemplateSchema);
export const DocumentAutomationRun =
  mongoose.models.DocumentAutomationRun || mongoose.model('DocumentAutomationRun', documentAutomationRunSchema);
