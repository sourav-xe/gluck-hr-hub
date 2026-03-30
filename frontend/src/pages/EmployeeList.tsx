import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Employee } from '@/types/hr';
import { fetchEmployees } from '@/lib/employeeService';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MemberList from '@/components/ui/member-list';
import {
  Plus, Search, Pencil, Loader2,
  ClipboardList, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function OnboardingBadge({ status }: { status: boolean | null | undefined }) {
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-2.5 h-2.5" /> Done
      </span>
    );
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/12 text-amber-400 border border-amber-500/20 animate-pulse">
        <ClipboardList className="w-2.5 h-2.5" /> Pending
      </span>
    );
  }
  // null = legacy employee, profile might be incomplete
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted/50 text-muted-foreground border border-border/40">
      <ClipboardList className="w-2.5 h-2.5" /> Not Set
    </span>
  );
}

export default function EmployeeList() {
  const navigate = useNavigate();
  const { hasAccess } = useAuth();
  const canEdit = hasAccess(['super_admin', 'hr_manager']);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onboardingFilter, setOnboardingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees().then(emps => {
      setDbEmployees(emps);
      setLoading(false);
    });
  }, []);

  const pendingCount = dbEmployees.filter(e => e.onboardingComplete === false).length;

  const filtered = dbEmployees.filter(e => {
    const matchSearch =
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.email || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || e.type === typeFilter;
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchOnboarding =
      onboardingFilter === 'all' ||
      (onboardingFilter === 'pending' && e.onboardingComplete === false) ||
      (onboardingFilter === 'done' && e.onboardingComplete === true) ||
      (onboardingFilter === 'not_set' && (e.onboardingComplete === null || e.onboardingComplete === undefined));
    return matchSearch && matchType && matchStatus && matchOnboarding;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Employees"
        description={`${dbEmployees.length} total employees`}
        action={
          <Button onClick={() => navigate('/employees/new')} className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        }
      />

      {/* Onboarding pending banner */}
      {pendingCount > 0 && canEdit && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300">
              <span className="font-semibold">{pendingCount} employee{pendingCount > 1 ? 's' : ''}</span> {pendingCount > 1 ? 'have' : 'has'} not completed onboarding yet.
              They will see the onboarding form on their next login.
            </p>
          </div>
          <button
            onClick={() => setOnboardingFilter(onboardingFilter === 'pending' ? 'all' : 'pending')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
          >
            {onboardingFilter === 'pending' ? 'Show all' : 'View pending →'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or department..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 rounded-xl h-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Full Time">Full Time</SelectItem>
            <SelectItem value="Freelancer">Freelancer</SelectItem>
            <SelectItem value="Intern">Intern</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="On Leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
        <Select value={onboardingFilter} onValueChange={v => { setOnboardingFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44 rounded-xl h-10"><SelectValue placeholder="Onboarding" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Onboarding</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="done">Completed</SelectItem>
            <SelectItem value="not_set">Not Set</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading employees...
          </div>
        ) : (
          <MemberList
            columns={[
              {
                id: 'name',
                header: 'Name',
                width: '260px',
                cellClassName: 'min-w-[260px]',
                render: (emp: Employee) => {
                  const isPending = emp.onboardingComplete === false;
                  return (
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isPending
                            ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                            : 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary'
                        }`}
                      >
                        {emp.fullName.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-none">{emp.fullName}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{emp.email}</p>
                      </div>
                    </div>
                  );
                },
              },
              {
                id: 'role',
                header: 'Role / Department',
                width: '220px',
                cellClassName: 'min-w-[220px]',
                render: (emp: Employee) =>
                  emp.jobTitle || emp.department ? (
                    <div>
                      <p className="text-sm font-medium">{emp.jobTitle || '—'}</p>
                      <p className="text-[11px] text-muted-foreground">{emp.department || ''}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Not set yet</span>
                  ),
              },
              {
                id: 'type',
                header: 'Type',
                width: '120px',
                cellClassName: 'min-w-[120px]',
                render: (emp: Employee) => <StatusBadge status={emp.type} />,
              },
              {
                id: 'joining',
                header: 'Joining Date',
                width: '150px',
                cellClassName: 'min-w-[150px]',
                render: (emp: Employee) =>
                  emp.joiningDate ? (
                    <span className="text-sm font-mono text-muted-foreground">{emp.joiningDate}</span>
                  ) : (
                    <span className="text-sm italic text-muted-foreground/50">—</span>
                  ),
              },
              {
                id: 'status',
                header: 'Status',
                width: '130px',
                cellClassName: 'min-w-[130px]',
                render: (emp: Employee) => <StatusBadge status={emp.status} />,
              },
              {
                id: 'onboarding',
                header: 'Onboarding',
                width: '160px',
                cellClassName: 'min-w-[160px]',
                render: (emp: Employee) => <OnboardingBadge status={emp.onboardingComplete} />,
              },
              ...(canEdit
                ? [
                    {
                      id: 'actions',
                      header: 'Actions',
                      width: '110px',
                      cellClassName: 'min-w-[110px] flex justify-end',
                      render: (emp: Employee) => (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          title="Edit employee"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/employees/${emp.id}/edit`);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={paginated}
            getRowId={(emp) => emp.id}
            onRowClick={(emp) => navigate(`/employees/${emp.id}`)}
            emptyState="No employees found"
            className="border-0 bg-transparent rounded-none"
          />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg">Previous</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg">Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
