import { useAuth } from "@/hooks/use-auth";
import NewAdminTimesheetTabs from "./NewAdminTimesheetTabs";
import StaffTimesheetView from "./StaffTimesheetView";

export default function TimesheetDashboard() {
  const { user } = useAuth();
  
  // Check if user is admin - if so, show NewAdminTimesheetTabs (case insensitive)
  if (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'consolemanager') {
    return <NewAdminTimesheetTabs />;
  }
  
  // For all other users (staff), show StaffTimesheetView
  return <StaffTimesheetView />;
}