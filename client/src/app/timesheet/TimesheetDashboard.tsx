import { useAuth } from "@/hooks/use-auth";
import AdminTimesheetTabs from "./AdminTimesheetTabs";
import StaffTimesheetView from "./StaffTimesheetView";

export default function TimesheetDashboard() {
  const { user } = useAuth();
  
  // Check if user is admin - if so, show AdminTimesheetTabs
  if (user?.role === 'Admin' || user?.role === 'ConsoleManager') {
    return <AdminTimesheetTabs />;
  }
  
  // For all other users (staff), show StaffTimesheetView
  return <StaffTimesheetView />;
}