import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/hr';

export interface DbEmployee {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  type: string;
  department: string;
  job_title: string;
  reporting_manager_id: string | null;
  joining_date: string;
  date_of_birth: string;
  salary_type: string;
  salary_amount: number;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  address: string;
  nationality: string;
  passport_number: string;
  status: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function dbToEmployee(db: DbEmployee): Employee {
  return {
    id: db.id,
    fullName: db.full_name,
    email: db.email,
    phone: db.phone,
    type: db.type as Employee['type'],
    department: db.department,
    jobTitle: db.job_title,
    reportingManagerId: db.reporting_manager_id || undefined,
    joiningDate: db.joining_date,
    dateOfBirth: db.date_of_birth,
    salaryType: db.salary_type as Employee['salaryType'],
    salaryAmount: db.salary_amount,
    bankName: db.bank_name,
    accountNumber: db.account_number,
    accountHolderName: db.account_holder_name,
    address: db.address,
    nationality: db.nationality,
    passportNumber: db.passport_number || undefined,
    status: db.status as Employee['status'],
    avatar: db.avatar_url || undefined,
  };
}

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  return (data as unknown as DbEmployee[]).map(dbToEmployee);
}

export async function fetchEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching employee:', error);
    return null;
  }

  return dbToEmployee(data as unknown as DbEmployee);
}
