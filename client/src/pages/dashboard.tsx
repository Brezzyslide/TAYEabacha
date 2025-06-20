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
      {/* Welcome Header with TUSK Styling */}
      <div className="bg-gradient-to-r from-primary/10 via-secondary/5 to-accent/10 rounded-3xl p-8 border border-primary/20 card-premium backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-3">
              Welcome to your NeedCareAI+ Workspace
            </h1>
            <p className="text-muted-foreground text-lg font-medium">
              Care that starts with listening, not loading. Your sophisticated dashboard is ready.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 bg-gradient-to-br from-primary via-secondary to-accent rounded-3xl flex items-center justify-center shadow-2xl glass-effect">
              <span className="text-white font-bold text-2xl">AI+</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto bg-gradient-to-r from-muted/50 via-white/60 to-muted/50 card-elevated-lg rounded-2xl p-1">
          <TabsTrigger value="insights" className="text-sm sm:text-base py-4 px-2 sm:px-6 rounded-xl font-medium transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-white data-[state=active]:shadow-xl">
            <span className="hidden sm:inline">Auto </span>Insights
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-sm sm:text-base py-4 px-2 sm:px-6 rounded-xl font-medium transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-white data-[state=active]:shadow-xl">
            Task Board
          </TabsTrigger>
          <TabsTrigger value="quick" className="text-sm sm:text-base py-4 px-2 sm:px-6 rounded-xl font-medium transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-white data-[state=active]:shadow-xl">
            <span className="hidden sm:inline">Quick </span>Actions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="insights" className="space-y-6 mt-8">
          <div className="bg-gradient-to-br from-white via-background/50 to-accent/5 rounded-3xl p-8 border border-primary/10 card-premium backdrop-blur-sm">
            <AutoInsightsPanel />
          </div>
        </TabsContent>
        
        <TabsContent value="tasks" className="space-y-6 mt-8">
          <div className="bg-gradient-to-br from-white via-background/50 to-secondary/5 rounded-3xl p-8 border border-primary/10 card-premium backdrop-blur-sm">
            <ManualTaskBoard key="task-board-persistent" />
          </div>
        </TabsContent>
        
        <TabsContent value="quick" className="space-y-6 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-white via-background/50 to-accent/5 rounded-3xl p-8 border border-primary/10 card-premium backdrop-blur-sm">
              <QuickActions />
            </div>
            <div className="bg-gradient-to-br from-white via-background/50 to-secondary/5 rounded-3xl p-8 border border-primary/10 card-premium backdrop-blur-sm">
              <RecentActivity />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
