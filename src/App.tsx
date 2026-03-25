import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
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
import TemplateUpload from "@/pages/TemplateUpload";
import TemplateList from "@/pages/TemplateList";
import GenerateFromTemplate from "@/pages/GenerateFromTemplate";
import AutomationsPage from "@/pages/AutomationsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center text-primary-foreground font-bold shadow-lg animate-pulse">
            GG
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
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
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated && !isLoading ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
