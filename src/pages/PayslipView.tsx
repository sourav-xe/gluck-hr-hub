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
      <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate('/payroll')}>Back</Button>
    </div>
  );

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/payroll')} className="gap-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>
        <Button variant="outline" className="gap-2 rounded-xl"><Download className="w-4 h-4" /> Download PDF</Button>
      </div>

      <div className="glass-card rounded-2xl p-8 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/50 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">GG</div>
              <div>
                <h2 className="text-lg font-bold">Gluck Global</h2>
                <p className="text-xs text-muted-foreground">International Staffing & Training</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy</p>
            <p className="text-xs text-muted-foreground">info@gluckglobal.com | www.gluckglobal.com</p>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Payslip</h3>
            <p className="text-sm text-muted-foreground font-mono">{record.month} {record.year}</p>
          </div>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6 glass-card rounded-xl p-4">
          <div><span className="text-muted-foreground text-xs">Employee:</span> <strong>{emp.fullName}</strong></div>
          <div><span className="text-muted-foreground text-xs">Department:</span> {emp.department}</div>
          <div><span className="text-muted-foreground text-xs">Job Title:</span> {emp.jobTitle}</div>
          <div><span className="text-muted-foreground text-xs">Employee ID:</span> <span className="font-mono">{emp.id}</span></div>
        </div>

        {/* Salary Details */}
        <div className="border border-border/50 rounded-xl overflow-hidden mb-6">
          <div className="bg-muted/30 px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-muted-foreground">Earnings & Deductions</div>
          <div className="divide-y divide-border/50">
            <div className="flex justify-between px-4 py-3 text-sm"><span>Basic Salary</span><span className="font-mono font-semibold">LKR {record.baseSalary.toLocaleString()}</span></div>
            <div className="flex justify-between px-4 py-3 text-sm"><span>Bonus</span><span className="font-mono text-success">+ LKR {record.bonus.toLocaleString()}</span></div>
            <div className="flex justify-between px-4 py-3 text-sm"><span>Leave Deductions</span><span className="font-mono text-destructive">- LKR {record.leaveDeductions.toLocaleString()}</span></div>
          </div>
          <div className="flex justify-between px-4 py-3 bg-primary/5 font-bold">
            <span>Net Payable</span><span className="font-mono">LKR {record.netPayable.toLocaleString()}</span>
          </div>
        </div>

        {/* Bank */}
        <div className="text-sm space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bank Details</p>
          <p className="font-mono text-muted-foreground">{emp.bankName} | A/C: {emp.accountNumber} | {emp.accountHolderName}</p>
        </div>
      </div>
    </div>
  );
}
