import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AutoInsightsPanel from "@/app/workflow-dashboard/components/AutoInsightsPanel";
import ManualTaskBoard from "@/app/workflow-dashboard/components/ManualTaskBoard";
import QuickActions from "@/components/dashboard/quick-actions";
import RecentActivity from "@/components/dashboard/recent-activity";


export default function Dashboard() {
  const { user } = useAuth();

  // Role-based dashboard filtering - TeamLeader+ can access workflow features
  const canViewWorkflowDashboard = ['TeamLeader', 'Coordinator', 'Admin', 'ConsoleManager'].includes(user?.role || '');
  const canManageTasks = ['TeamLeader', 'Coordinator', 'Admin', 'ConsoleManager'].includes(user?.role || '');

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-4 space-y-4">
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="insights">System Insights</TabsTrigger>
              <TabsTrigger value="tasks">Task Board</TabsTrigger>
              <TabsTrigger value="quick">Quick Actions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="insights" className="space-y-4">
              <AutoInsightsPanel />
            </TabsContent>
            
            <TabsContent value="tasks" className="space-y-3">
              <ManualTaskBoard key="task-board-persistent" />
            </TabsContent>
            
            <TabsContent value="quick" className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <QuickActions />
                <RecentActivity />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
