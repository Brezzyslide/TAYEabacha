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
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-xl p-6 border border-primary/10 card-elevated">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Welcome to your NeedCareAI+ Workspace
            </h1>
            <p className="text-muted-foreground">
              Care that starts with listening, not loading. Your participant-centric dashboard is ready.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">AI+</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto bg-muted/50 card-elevated">
          <TabsTrigger value="insights" className="text-xs sm:text-sm py-3 px-1 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Auto </span>Insights
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs sm:text-sm py-3 px-1 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Task Board
          </TabsTrigger>
          <TabsTrigger value="quick" className="text-xs sm:text-sm py-3 px-1 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Quick </span>Actions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="insights" className="space-y-6 mt-6">
          <div className="bg-card rounded-xl p-6 border border-border card-elevated">
            <AutoInsightsPanel />
          </div>
        </TabsContent>
        
        <TabsContent value="tasks" className="space-y-6 mt-6">
          <div className="bg-card rounded-xl p-6 border border-border card-elevated">
            <ManualTaskBoard key="task-board-persistent" />
          </div>
        </TabsContent>
        
        <TabsContent value="quick" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl p-6 border border-border card-elevated">
              <QuickActions />
            </div>
            <div className="bg-card rounded-xl p-6 border border-border card-elevated">
              <RecentActivity />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
