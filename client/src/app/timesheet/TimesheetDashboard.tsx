import { useAuth } from "@/hooks/use-auth";
import AdminTimesheetTabs from "./AdminTimesheetTabs";
import StaffTimesheetView from "./StaffTimesheetView";

export default function TimesheetDashboard() {
  const { user } = useAuth();
  
  // Check if user is admin - if so, show AdminTimesheetTabs (case insensitive)
  if (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'consolemanager') {
    return <AdminTimesheetTabs />;
  }
  
  // For all other users (staff), show StaffTimesheetView
  return <StaffTimesheetView />;
}