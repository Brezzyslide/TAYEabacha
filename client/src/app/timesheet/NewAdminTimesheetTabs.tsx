import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, Settings, BarChart3 } from "lucide-react";
import TimesheetReviewDashboard from "./components/TimesheetReviewDashboard";
import PayrollReadyTab from "./components/PayrollReadyTab";
import SettingsAndRatesTab from "./components/SettingsAndRatesTab";
import ReportsTab from "./components/ReportsTab";

export default function NewAdminTimesheetTabs() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Timesheet Administration</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Review submissions, manage payroll, and configure timesheet settings
        </p>
      </div>

      <Tabs defaultValue="review" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="review" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Review & Approve
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Payroll Ready
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings & Rates
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <TimesheetReviewDashboard />
        </TabsContent>

        <TabsContent value="payroll">
          <PayrollReadyTab />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsAndRatesTab />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}