import { Switch, Route } from "wouter";
import { lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import UniversalHeader from "@/components/layout/universal-header";
import Sidebar from "@/components/layout/sidebar";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Staff from "@/pages/staff";

import Forms from "@/pages/forms";
import Reports from "@/pages/reports";
import Export from "@/pages/export";
import ClientProfilePage from "@/app/support-work/client-profile/ClientProfilePage";
import ClientProfileDashboard from "@/app/support-work/client-profile/ClientProfileDashboard";
import SimpleCreateClientForm from "@/app/support-work/client-profile/components/SimpleCreateClientForm";
import ClientListPage from "@/app/support-work/client-profile/components/ClientListPage";
import EditClientForm from "@/app/support-work/client-profile/components/EditClientForm";
import SupportWorkPage from "@/pages/support-work";
import ShiftDashboard from "@/app/shift/ShiftDashboard";
import ShiftCalendar from "@/app/shift/ShiftCalendar";
import StaffAvailabilityPage from "@/app/staff-availability/StaffAvailabilityPage";
import ManageStaffAvailabilityPage from "@/app/manage-staff-availability/ManageStaffAvailabilityPage";
import ObservationDashboard from "@/app/hourly-observations/ObservationDashboard";
import CaseNoteDashboard from "@/app/case-notes/CaseNoteDashboard";
import IncidentDashboard from "@/app/incident-management/IncidentDashboard";
import MedicationDashboard from "@/app/medications/MedicationDashboard";
import MessageDashboard from "@/app/messages/MessageDashboard";
import CreateCompanyPage from "@/app/admin/create-company/CreateCompanyPage";
import CompanySummaryPage from "@/app/admin/company-summary/CompanySummaryPage";
import CompanyListPage from "@/app/admin/companies/CompanyListPage";
import CompanyDetailsPage from "@/app/admin/companies/CompanyDetailsPage";
import StaffHourDashboard from "@/app/staff-hour-allocations/StaffHourDashboard";
import RolesPermissionsDashboard from "@/app/roles-permissions/RolesPermissionsDashboard";
import WorkflowDashboard from "@/app/workflow-dashboard/WorkflowDashboard";
import BudgetDashboard from "@/app/budget-management/BudgetDashboard";
import { CareSupportPlans } from "@/app/care-support-plans/CareSupportPlans";
import TimesheetDashboard from "@/app/timesheet/TimesheetDashboard";
import BillingDashboard from "@/app/billing/BillingDashboard";
import LandingPage from "@/pages/LandingPage";
import EmergencyCleanup from "@/app/emergency/EmergencyCleanup";
import CompliancePage from "@/app/compliance/page";
import ServiceAgreementsList from "@/app/compliance/service-agreements/index";
import CreateServiceAgreement from "@/app/compliance/service-agreements/create";
import EditServiceAgreement from "@/app/compliance/service-agreements/edit/[id]";
import ViewServiceAgreement from "@/app/compliance/service-agreements/view/[id]";
import ReferralFormsIndex from "@/app/compliance/referral-forms/index";
import CreateReferralForm from "@/app/compliance/referral-forms/create";
import ViewReferralForm from "@/app/compliance/referral-forms/view/[id]";
import ReferralLinksPage from "@/app/compliance/referral-links/index";
import ReferralManagementPage from "@/app/compliance/referral-management/index";
import InvoicesIndex from "@/app/compliance/invoices/index";
import CreateInvoice from "@/app/compliance/invoices/create";
import ViewInvoice from "@/app/compliance/invoices/view/[id]";
import PricingManagement from "@/app/compliance/pricing/index";
import PublicSignPage from "@/pages/public-sign";
import PublicReferralForm from "@/pages/PublicReferralForm";
import { ProtectedRoute } from "./lib/protected-route";
import { VerifyAuth } from "./debug/verifyAuth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/sign/:token" component={PublicSignPage} />
      <Route path="/share/referral/:token" component={PublicReferralForm} />
      <Route path="/referral/:token" component={PublicReferralForm} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/clients" component={ClientListPage} />
      <ProtectedRoute path="/clients/create" component={() => <SimpleCreateClientForm />} />
      <ProtectedRoute path="/client/:clientId" component={ClientProfilePage} />
      <ProtectedRoute path="/support-work" component={SupportWorkPage} />
      <ProtectedRoute path="/support-work/client-profile/create" component={() => <SimpleCreateClientForm />} />
      <ProtectedRoute path="/support-work/client-profile/edit/:clientId" component={EditClientForm} />
      <ProtectedRoute path="/support-work/client-profile/:clientId" component={ClientProfilePage} />
      <ProtectedRoute path="/support-work/client-profile" component={ClientProfileDashboard} />
      <ProtectedRoute path="/shift" component={ShiftDashboard} />
      <ProtectedRoute path="/staff-availability" component={StaffAvailabilityPage} />
      <ProtectedRoute path="/manage-staff-availability" component={ManageStaffAvailabilityPage} />
      <ProtectedRoute path="/staff-hour-allocations" component={StaffHourDashboard} />
      <ProtectedRoute path="/hourly-observations" component={ObservationDashboard} />
      <ProtectedRoute path="/case-notes" component={CaseNoteDashboard} />
      <ProtectedRoute path="/incident-management" component={IncidentDashboard} />
      <ProtectedRoute path="/medications" component={MedicationDashboard} />
      <ProtectedRoute path="/messages" component={MessageDashboard} />
      <ProtectedRoute path="/staff" component={Staff} />
      <ProtectedRoute path="/roles-permissions" component={RolesPermissionsDashboard} />
      <ProtectedRoute path="/workflow-dashboard" component={WorkflowDashboard} />
      <ProtectedRoute path="/budget-management" component={BudgetDashboard} />
      <ProtectedRoute path="/care-support-plans" component={CareSupportPlans} />
      <ProtectedRoute path="/timesheet" component={TimesheetDashboard} />
      <ProtectedRoute path="/billing" component={BillingDashboard} />
      <ProtectedRoute path="/billing-management" component={BillingDashboard} />
      <ProtectedRoute path="/compliance" component={CompliancePage} />
      <ProtectedRoute path="/compliance/service-agreements" component={ServiceAgreementsList} />
      <ProtectedRoute path="/compliance/service-agreements/create" component={CreateServiceAgreement} />
      <ProtectedRoute path="/compliance/service-agreements/view/:id" component={ViewServiceAgreement} />
      <ProtectedRoute path="/compliance/service-agreements/edit/:id" component={EditServiceAgreement} />
      <ProtectedRoute path="/compliance/referral-forms" component={ReferralFormsIndex} />
      <ProtectedRoute path="/compliance/referral-forms/create" component={CreateReferralForm} />
      <ProtectedRoute path="/compliance/referral-forms/view/:id" component={ViewReferralForm} />
      <ProtectedRoute path="/compliance/referral-links" component={ReferralLinksPage} />
      <ProtectedRoute path="/compliance/referral-management" component={ReferralManagementPage} />
      <ProtectedRoute path="/compliance/invoices" component={InvoicesIndex} />
      <ProtectedRoute path="/compliance/invoices/create" component={CreateInvoice} />
      <ProtectedRoute path="/compliance/invoices/view/:id" component={ViewInvoice} />
      <ProtectedRoute path="/compliance/pricing" component={PricingManagement} />

      <ProtectedRoute path="/forms" component={Forms} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/export" component={Export} />
      <ProtectedRoute path="/admin/companies" component={CompanyListPage} />
      <ProtectedRoute path="/admin/companies/:id" component={CompanyDetailsPage} />
      <Route path="/admin/create-company" component={CreateCompanyPage} />
      <Route path="/admin/company-summary" component={CompanySummaryPage} />
      <ProtectedRoute path="/emergency-cleanup" component={EmergencyCleanup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <VerifyAuth />
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
