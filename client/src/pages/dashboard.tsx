import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import StatsCards from "@/components/dashboard/stats-cards";
import QuickActions from "@/components/dashboard/quick-actions";
import RecentActivity from "@/components/dashboard/recent-activity";
import CurrentShifts from "@/components/dashboard/current-shifts";
import FormBuilderPreview from "@/components/forms/form-builder";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6 space-y-6">
          <StatsCards />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <QuickActions />
            <RecentActivity />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CurrentShifts />
            <FormBuilderPreview />
          </div>
        </main>
      </div>
    </div>
  );
}
