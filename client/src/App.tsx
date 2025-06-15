import { Switch, Route } from "wouter";
import { lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import UniversalHeader from "@/components/layout/universal-header";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Staff from "@/pages/staff";

import Forms from "@/pages/forms";
import Reports from "@/pages/reports";
import Export from "@/pages/export";
import ClientProfileDemo from "@/app/support-work/client-profile/ClientProfileDemo";
import ClientProfileDashboard from "@/app/support-work/client-profile/ClientProfileDashboard";
import CreateClientForm from "@/app/support-work/client-profile/components/CreateClientForm";

// Wrapper component for routing
function CreateClientFormPage() {
  return <CreateClientForm onSuccess={() => window.history.back()} onCancel={() => window.history.back()} />;
}
import ClientListPage from "@/app/support-work/client-profile/components/ClientListPage";
import SupportWorkPage from "@/pages/support-work";
import ShiftDashboard from "@/app/shift/ShiftDashboard";
import ShiftCalendar from "@/app/shift/ShiftCalendar";
import StaffAvailabilityPage from "@/app/staff-availability/StaffAvailabilityPage";
import ManageStaffAvailabilityPage from "@/app/manage-staff-availability/ManageStaffAvailabilityPage";

import MessageDashboard from "@/app/messages/MessageDashboard";
import CreateCompanyPage from "@/app/admin/create-company/CreateCompanyPage";
import CompanySummaryPage from "@/app/admin/company-summary/CompanySummaryPage";
import CompanyListPage from "@/app/admin/companies/CompanyListPage";
import StaffHourDashboard from "@/app/staff-hour-allocations/StaffHourDashboard";
import RolesPermissionsDashboard from "@/app/roles-permissions/RolesPermissionsDashboard";
import WorkflowDashboard from "@/app/workflow-dashboard/WorkflowDashboard";
import BudgetDashboard from "@/app/budget-management/BudgetDashboard";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/clients" component={ClientListPage} />
      <ProtectedRoute path="/clients/create" component={CreateClientFormPage} />
      <ProtectedRoute path="/client/:clientId" component={ClientProfileDemo} />
      <ProtectedRoute path="/support-work" component={SupportWorkPage} />
      <ProtectedRoute path="/support-work/client-profile" component={ClientProfileDashboard} />
      <ProtectedRoute path="/support-work/client-profile/create" component={CreateClientFormPage} />
      <ProtectedRoute path="/support-work/client-profile/:clientId" component={ClientProfileDemo} />
      <ProtectedRoute path="/shift" component={ShiftDashboard} />
      <ProtectedRoute path="/staff-availability" component={StaffAvailabilityPage} />
      <ProtectedRoute path="/manage-staff-availability" component={ManageStaffAvailabilityPage} />
      <ProtectedRoute path="/staff-hour-allocations" component={StaffHourDashboard} />

      <ProtectedRoute path="/messages" component={MessageDashboard} />
      <ProtectedRoute path="/staff" component={Staff} />
      <ProtectedRoute path="/roles-permissions" component={RolesPermissionsDashboard} />
      <ProtectedRoute path="/workflow-dashboard" component={WorkflowDashboard} />
      <ProtectedRoute path="/budget-management" component={BudgetDashboard} />

      <ProtectedRoute path="/forms" component={Forms} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/export" component={Export} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/admin/companies" component={CompanyListPage} />
      <Route path="/admin/create-company" component={CreateCompanyPage} />
      <Route path="/admin/company-summary" component={CompanySummaryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <UniversalHeader />
            <Router />
          </div>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
