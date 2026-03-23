import {
  Employee, AttendanceRecord, LeaveRequest, LeaveBalance,
  PayrollRecord, GeneratedDocument, Automation, AttendanceStatus, ClockRecord, AttendanceSettings
} from '@/types/hr';

export const employees: Employee[] = [
  {
    id: '1', fullName: 'Ashan Perera', email: 'ashan@gluckglobal.com', phone: '+94 77 123 4567',
    type: 'Full Time', department: 'Human Resources', jobTitle: 'HR Manager',
    joiningDate: '01/01/2023', dateOfBirth: '15/03/1990', salaryType: 'Fixed Monthly',
    salaryAmount: 85000, bankName: 'Commercial Bank', accountNumber: '1234567890',
    accountHolderName: 'Ashan Perera', address: '45 Temple Road, Kandy',
    nationality: 'Sri Lankan', passportNumber: 'N1234567', status: 'Active',
  },
  {
    id: '2', fullName: 'Dilini Fernando', email: 'dilini@gluckglobal.com', phone: '+94 71 234 5678',
    type: 'Full Time', department: 'Recruitment', jobTitle: 'Recruiter',
    reportingManagerId: '1', joiningDate: '15/03/2023', dateOfBirth: '22/07/1993',
    salaryType: 'Fixed Monthly', salaryAmount: 65000, bankName: 'Sampath Bank',
    accountNumber: '9876543210', accountHolderName: 'Dilini Fernando',
    address: '12 Lake View, Peradeniya', nationality: 'Sri Lankan', status: 'Active',
  },
  {
    id: '3', fullName: 'Rajan Nair', email: 'rajan@gluckglobal.com', phone: '+94 76 345 6789',
    type: 'Freelancer', department: 'Training', jobTitle: 'Trainer/Tutor',
    joiningDate: '01/06/2023', dateOfBirth: '08/11/1985', salaryType: 'Per Session',
    salaryAmount: 2500, bankName: 'HNB', accountNumber: '5555666677',
    accountHolderName: 'Rajan Nair', address: '78 Hill Street, Kandy',
    nationality: 'Indian', passportNumber: 'J8765432', status: 'Active',
  },
  {
    id: '4', fullName: 'Priya Jayasinghe', email: 'priya@gluckglobal.com', phone: '+94 72 456 7890',
    type: 'Full Time', department: 'Administration', jobTitle: 'Admin Executive',
    reportingManagerId: '1', joiningDate: '01/06/2024', dateOfBirth: '30/12/1995',
    salaryType: 'Fixed Monthly', salaryAmount: 55000, bankName: 'BOC',
    accountNumber: '1111222233', accountHolderName: 'Priya Jayasinghe',
    address: '23 Dalada Veediya, Kandy', nationality: 'Sri Lankan', status: 'Active',
  },
  {
    id: '5', fullName: 'Kasun Silva', email: 'kasun@gluckglobal.com', phone: '+94 78 567 8901',
    type: 'Intern', department: 'Human Resources', jobTitle: 'Intern',
    reportingManagerId: '1', joiningDate: '01/01/2025', dateOfBirth: '25/06/2002',
    salaryType: 'Fixed Monthly', salaryAmount: 15000, bankName: 'People\'s Bank',
    accountNumber: '4444555566', accountHolderName: 'Kasun Silva',
    address: '56 Katugastota Road, Kandy', nationality: 'Sri Lankan', status: 'Active',
  },
];

export const defaultAttendanceSettings: AttendanceSettings = {
  ipRestrictionEnabled: false,
  allowedIPs: ['192.168.1.0/24'],
  autoMarkAbsent: true,
  halfDayThresholdHours: 4,
  fullDayThresholdHours: 8,
};

function generateAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const statuses: AttendanceStatus[] = ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'L', 'WFH', 'HD', 'A', 'P', 'P'];
  const months = [
    { year: 2025, month: 0 },
    { year: 2025, month: 1 },
    { year: 2025, month: 2 },
  ];

  employees.forEach(emp => {
    months.forEach(({ year, month }) => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const clockIn = status === 'P' || status === 'WFH' || status === 'HD' 
          ? `0${8 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}` 
          : undefined;
        const clockOut = clockIn 
          ? status === 'HD' 
            ? `1${2 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
            : `1${7 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
          : undefined;
        
        let totalHours: number | undefined;
        if (clockIn && clockOut) {
          const [inH, inM] = clockIn.split(':').map(Number);
          const [outH, outM] = clockOut.split(':').map(Number);
          totalHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
        }

        records.push({
          employeeId: emp.id,
          date: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
          status,
          clockIn,
          clockOut,
          totalHours,
        });
      }
    });
  });
  return records;
}

export const attendanceRecords: AttendanceRecord[] = generateAttendance();

export const clockRecords: ClockRecord[] = [];

export const leaveRequests: LeaveRequest[] = [
  { id: 'L1', employeeId: '2', leaveType: 'Annual', fromDate: '10/03/2025', toDate: '12/03/2025', days: 3, reason: 'Family vacation', status: 'Approved', createdAt: '05/03/2025' },
  { id: 'L2', employeeId: '4', leaveType: 'Sick', fromDate: '18/02/2025', toDate: '19/02/2025', days: 2, reason: 'Medical appointment', status: 'Approved', createdAt: '17/02/2025' },
  { id: 'L3', employeeId: '1', leaveType: 'Casual', fromDate: '25/03/2025', toDate: '25/03/2025', days: 1, reason: 'Personal matters', status: 'Pending', createdAt: '20/03/2025' },
  { id: 'L4', employeeId: '5', leaveType: 'Annual', fromDate: '01/04/2025', toDate: '03/04/2025', days: 3, reason: 'Travel plans', status: 'Pending', createdAt: '22/03/2025' },
  { id: 'L5', employeeId: '2', leaveType: 'Unpaid', fromDate: '15/01/2025', toDate: '17/01/2025', days: 3, reason: 'Extended personal leave', status: 'Rejected', note: 'Insufficient notice period', createdAt: '10/01/2025' },
];

export const leaveBalances: LeaveBalance[] = [
  { employeeId: '1', annual: 12, sick: 7, casual: 5 },
  { employeeId: '2', annual: 9, sick: 7, casual: 4 },
  { employeeId: '4', annual: 14, sick: 5, casual: 5 },
  { employeeId: '5', annual: 7, sick: 7, casual: 5 },
];

export const payrollRecords: PayrollRecord[] = [
  { id: 'P1', employeeId: '1', month: 'March', year: 2025, baseSalary: 85000, leaveDeductions: 0, bonus: 5000, netPayable: 90000, status: 'Unpaid' },
  { id: 'P2', employeeId: '2', month: 'March', year: 2025, baseSalary: 65000, leaveDeductions: 0, bonus: 0, netPayable: 65000, status: 'Unpaid' },
  { id: 'P3', employeeId: '4', month: 'March', year: 2025, baseSalary: 55000, leaveDeductions: 0, bonus: 0, netPayable: 55000, status: 'Unpaid' },
  { id: 'P4', employeeId: '5', month: 'March', year: 2025, baseSalary: 15000, leaveDeductions: 0, bonus: 0, netPayable: 15000, status: 'Unpaid' },
  { id: 'P5', employeeId: '1', month: 'February', year: 2025, baseSalary: 85000, leaveDeductions: 0, bonus: 0, netPayable: 85000, status: 'Paid' },
  { id: 'P6', employeeId: '2', month: 'February', year: 2025, baseSalary: 65000, leaveDeductions: 6500, bonus: 0, netPayable: 58500, status: 'Paid' },
  { id: 'P7', employeeId: '4', month: 'February', year: 2025, baseSalary: 55000, leaveDeductions: 0, bonus: 2000, netPayable: 57000, status: 'Paid' },
  { id: 'P8', employeeId: '5', month: 'February', year: 2025, baseSalary: 15000, leaveDeductions: 0, bonus: 0, netPayable: 15000, status: 'Paid' },
];

export const generatedDocuments: GeneratedDocument[] = [
  { id: 'D1', name: 'Offer Letter - Kasun Silva', type: 'Offer Letter', linkedTo: 'Kasun Silva', linkedType: 'Employee', date: '20/12/2024' },
  { id: 'D2', name: 'Freelancer Agreement - Rajan Nair', type: 'Freelancer Agreement', linkedTo: 'Rajan Nair', linkedType: 'Employee', date: '01/06/2023' },
  { id: 'D3', name: 'Employment Contract - Priya Jayasinghe', type: 'Employment Contract', linkedTo: 'Priya Jayasinghe', linkedType: 'Employee', date: '01/06/2024' },
];

export const automations: Automation[] = [
  { id: 'A1', name: 'Birthday Notifier', description: 'Daily check for employee birthdays, notify HR admin', active: true, lastTriggered: '23/03/2025' },
  { id: 'A2', name: 'Welcome Message', description: 'Auto-draft welcome message when new employee added', active: true, lastTriggered: '01/01/2025' },
  { id: 'A3', name: 'Pre-joining Reminder', description: '7 days before start date, remind HR to prepare', active: true, lastTriggered: '25/12/2024' },
  { id: 'A4', name: 'Attendance Reminder', description: 'If attendance not marked by 10am, send reminder', active: false },
  { id: 'A5', name: 'Timesheet Reminder', description: 'Last 3 days of month, notify employees to submit timesheets', active: true, lastTriggered: '28/02/2025' },
  { id: 'A6', name: 'Salary Paid Notification', description: 'Auto email when Mark Paid is triggered', active: true, lastTriggered: '28/02/2025' },
  { id: 'A7', name: 'Leave Approval Notification', description: 'Email employee when leave approved/rejected', active: true, lastTriggered: '20/03/2025' },
];
