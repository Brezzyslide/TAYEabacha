import { useAuth } from "@/hooks/use-auth";
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
    <div className="space-y-3 sm:space-y-4 p-2 sm:p-0">
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="insights" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <span className="hidden sm:inline">System </span>Insights
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            Task Board
          </TabsTrigger>
          <TabsTrigger value="quick" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <span className="hidden sm:inline">Quick </span>Actions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="insights" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
          <AutoInsightsPanel />
        </TabsContent>
        
        <TabsContent value="tasks" className="space-y-3 mt-3 sm:mt-4">
          <ManualTaskBoard key="task-board-persistent" />
        </TabsContent>
        
        <TabsContent value="quick" className="space-y-3 mt-3 sm:mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <QuickActions />
            <RecentActivity />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
