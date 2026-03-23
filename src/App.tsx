import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import EmployeeList from "@/pages/EmployeeList";
import EmployeeForm from "@/pages/EmployeeForm";
import EmployeeProfile from "@/pages/EmployeeProfile";
import AttendancePage from "@/pages/AttendancePage";
import DailyAttendance from "@/pages/DailyAttendance";
import MyAttendance from "@/pages/MyAttendance";
import LeaveList from "@/pages/LeaveList";
import LeaveForm from "@/pages/LeaveForm";
import PayrollPage from "@/pages/PayrollPage";
import PayslipView from "@/pages/PayslipView";
import DocumentsPage from "@/pages/DocumentsPage";
import DocumentGenerator from "@/pages/DocumentGenerator";
import AutomationsPage from "@/pages/AutomationsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/employees" element={<EmployeeList />} />
              <Route path="/employees/new" element={<EmployeeForm />} />
              <Route path="/employees/:id" element={<EmployeeProfile />} />
              <Route path="/employees/:id/edit" element={<EmployeeForm />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/attendance/daily" element={<DailyAttendance />} />
              <Route path="/my-attendance" element={<MyAttendance />} />
              <Route path="/leaves" element={<LeaveList />} />
              <Route path="/leaves/new" element={<LeaveForm />} />
              <Route path="/payroll" element={<PayrollPage />} />
              <Route path="/payroll/payslip/:id" element={<PayslipView />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/generate" element={<DocumentGenerator />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
