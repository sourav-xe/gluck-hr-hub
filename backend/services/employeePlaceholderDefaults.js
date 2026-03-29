/**
 * Map Employee document → common template keys (best-effort; templates may use any keys).
 * @param {import('mongoose').LeanDocument<any> | Record<string, unknown>} emp
 * @param {string} [reportingManagerName] - resolved manager display name when available
 */
export function defaultValuesFromEmployee(emp, reportingManagerName = '') {
  if (!emp) return {};
  const e = emp;
  const salary = e.salaryAmount != null ? Number(e.salaryAmount) : 0;
  const idStr = e._id != null ? String(e._id) : '';
  return {
    employee_full_name: String(e.fullName || ''),
    employee_name: String(e.fullName || ''),
    employee_id: String(e.employeeCode || idStr),
    employee_code: String(e.employeeCode || ''),
    employee_email: String(e.email || ''),
    employee_phone: String(e.phone || ''),
    employee_address: String(e.address || ''),
    department: String(e.department || ''),
    job_title: String(e.jobTitle || ''),
    joining_date: String(e.joiningDate || ''),
    reporting_manager: String(reportingManagerName || e.reportingManagerId || ''),
    salary_amount: salary ? String(salary) : '',
    salary_currency: 'LKR',
    salary_formatted: salary ? `LKR ${salary.toLocaleString('en-LK')}` : '',
    salary_type: String(e.salaryType || ''),
    date_of_birth: String(e.dateOfBirth || ''),
    nationality: String(e.nationality || ''),
    letter_date: new Date().toLocaleDateString('en-GB'),
  };
}
