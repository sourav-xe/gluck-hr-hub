import { useParams, useNavigate } from 'react-router-dom';
import { payrollRecords, employees } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';

export default function PayslipView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const record = payrollRecords.find(p => p.id === id);
  const emp = record ? employees.find(e => e.id === record.employeeId) : null;

  if (!record || !emp) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Payslip not found</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/payroll')}>Back</Button>
    </div>
  );

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/payroll')} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>
        <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Download PDF</Button>
      </div>

      <div className="bg-card rounded-lg border p-8 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">GG</div>
              <div>
                <h2 className="text-lg font-bold">Gluck Global</h2>
                <p className="text-xs text-muted-foreground">International Staffing & Training</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy</p>
            <p className="text-xs text-muted-foreground">info@gluckglobal.com | www.gluckglobal.com</p>
          </div>
          <div className="text-right">
            <h3 className="font-semibold text-sm">PAYSLIP</h3>
            <p className="text-sm text-muted-foreground">{record.month} {record.year}</p>
          </div>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><span className="text-muted-foreground">Employee:</span> <strong>{emp.fullName}</strong></div>
          <div><span className="text-muted-foreground">Department:</span> {emp.department}</div>
          <div><span className="text-muted-foreground">Job Title:</span> {emp.jobTitle}</div>
          <div><span className="text-muted-foreground">Employee ID:</span> {emp.id}</div>
        </div>

        {/* Salary Details */}
        <div className="border rounded-md overflow-hidden mb-6">
          <div className="bg-muted px-4 py-2 font-semibold text-sm">Earnings & Deductions</div>
          <div className="divide-y">
            <div className="flex justify-between px-4 py-3 text-sm"><span>Basic Salary</span><span>LKR {record.baseSalary.toLocaleString()}</span></div>
            <div className="flex justify-between px-4 py-3 text-sm"><span>Bonus</span><span>LKR {record.bonus.toLocaleString()}</span></div>
            <div className="flex justify-between px-4 py-3 text-sm"><span>Leave Deductions</span><span className="text-destructive">- LKR {record.leaveDeductions.toLocaleString()}</span></div>
          </div>
          <div className="flex justify-between px-4 py-3 bg-primary/5 font-semibold">
            <span>Net Payable</span><span>LKR {record.netPayable.toLocaleString()}</span>
          </div>
        </div>

        {/* Bank */}
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground font-medium">Bank Details</p>
          <p>{emp.bankName} | A/C: {emp.accountNumber} | {emp.accountHolderName}</p>
        </div>
      </div>
    </div>
  );
}
