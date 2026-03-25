import { Employee } from '@/types/hr';
import { apiFetch } from '@/lib/api';

export async function fetchEmployees(): Promise<Employee[]> {
  try {
    const res = await apiFetch('/api/employees');
    if (!res.ok) {
      console.error('Error fetching employees:', res.status);
      return [];
    }
    const data = (await res.json()) as Employee[];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Error fetching employees:', e);
    return [];
  }
}

export async function fetchEmployeeById(id: string): Promise<Employee | null> {
  try {
    const res = await apiFetch(`/api/employees/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error('Error fetching employee:', res.status);
      return null;
    }
    return (await res.json()) as Employee;
  } catch (e) {
    console.error('Error fetching employee:', e);
    return null;
  }
}

export async function createEmployeeWithUser(payload: {
  email: string;
  password: string;
  fullName: string;
  app_role: string;
  phone: string;
  type: string;
  department: string;
  jobTitle: string;
  reportingManagerId?: string;
  joiningDate: string;
  dateOfBirth?: string;
  salaryType: string;
  salaryAmount: number;
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  address?: string;
  nationality?: string;
  passportNumber?: string;
  status: string;
  requiresOnboarding?: boolean;
}): Promise<{ ok: true; employee: Employee } | { ok: false; error: string }> {
  const res = await apiFetch('/api/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string }).error || res.statusText };
  }
  return { ok: true, employee: data as Employee };
}

export async function updateEmployee(
  id: string,
  payload: Partial<Employee> & { password?: string }
): Promise<{ ok: true; employee: Employee } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    type: payload.type,
    department: payload.department,
    jobTitle: payload.jobTitle,
    reportingManagerId: payload.reportingManagerId ?? '',
    joiningDate: payload.joiningDate,
    dateOfBirth: payload.dateOfBirth,
    salaryType: payload.salaryType,
    salaryAmount: payload.salaryAmount,
    bankName: payload.bankName,
    accountNumber: payload.accountNumber,
    accountHolderName: payload.accountHolderName,
    address: payload.address,
    nationality: payload.nationality,
    passportNumber: payload.passportNumber,
    status: payload.status,
    avatar: payload.avatar,
  };
  if (payload.password) body.password = payload.password;

  const res = await apiFetch(`/api/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string }).error || res.statusText };
  }
  return { ok: true, employee: data as Employee };
}
