export type UserRole = 'super_admin' | 'hr_manager' | 'reporting_manager' | 'employee' | 'freelancer_intern';

export type EmployeeType = 'Full Time' | 'Freelancer' | 'Intern';
export type EmployeeStatus = 'Active' | 'Inactive' | 'On Leave';
export type SalaryType = 'Fixed Monthly' | 'Hourly Rate' | 'Per Session';
export type AttendanceStatus = 'P' | 'L' | 'WFH' | 'HD' | 'A';
export type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Unpaid' | 'Maternity' | 'Emergency';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type PayrollStatus = 'Unpaid' | 'Paid';
export type DocumentType =
  | 'Offer Letter' | 'Employment Contract' | 'Freelancer Agreement'
  | 'MOU' | 'Partner Agreement' | 'Candidate Agreement'
  | 'Experience Letter' | 'Confirmation Letter' | 'Warning Letter' | 'Relieving Letter';

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  type: EmployeeType;
  department: string;
  jobTitle: string;
  reportingManagerId?: string;
  joiningDate: string;
  dateOfBirth: string;
  salaryType: SalaryType;
  salaryAmount: number;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  address: string;
  nationality: string;
  passportNumber?: string;
  status: EmployeeStatus;
  avatar?: string;
}

export interface ClockRecord {
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  ipAddress?: string;
  status: AttendanceStatus;
  totalHours?: number;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  clockIn?: string;
  clockOut?: string;
  ipAddress?: string;
  totalHours?: number;
}

export interface AttendanceSettings {
  ipRestrictionEnabled: boolean;
  allowedIPs: string[];
  autoMarkAbsent: boolean;
  halfDayThresholdHours: number;
  fullDayThresholdHours: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  note?: string;
  approvedBy?: string;
  approvedByName?: string;
  createdAt: string;
}

export interface LeaveBalance {
  employeeId: string;
  annual: number;
  sick: number;
  casual: number;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string;
  year: number;
  baseSalary: number;
  leaveDeductions: number;
  bonus: number;
  netPayable: number;
  status: PayrollStatus;
}

export interface GeneratedDocument {
  id: string;
  name: string;
  type: DocumentType;
  linkedTo: string;
  linkedType: 'Employee' | 'Partner' | 'Candidate';
  date: string;
  content?: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  active: boolean;
  lastTriggered?: string;
}
