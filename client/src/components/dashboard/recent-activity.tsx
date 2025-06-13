import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type ActivityLog } from "@shared/schema";

export default function RecentActivity() {
  const { data: activityLogs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  const getActivityColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-500";
      case "update":
        return "bg-blue-500";
      case "delete":
        return "bg-red-500";
      case "start_shift":
        return "bg-blue-500";
      case "end_shift":
        return "bg-gray-500";
      case "export":
        return "bg-indigo-500";
      default:
        return "bg-purple-500";
    }
  };

  const getStatusBadge = (action: string) => {
    switch (action) {
      case "create":
        return <Badge variant="default" className="text-xs">Created</Badge>;
      case "update":
        return <Badge variant="secondary" className="text-xs">Updated</Badge>;
      case "start_shift":
        return <Badge variant="default" className="text-xs">Active</Badge>;
      case "end_shift":
        return <Badge variant="secondary" className="text-xs">Completed</Badge>;
      case "export":
        return <Badge variant="outline" className="text-xs">Exported</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Activity</Badge>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return time.toLocaleDateString();
    }
  };

  return (
    <div className="lg:col-span-2">
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 animate-pulse">
                  <div className="w-2 h-2 bg-gray-200 rounded-full mt-2"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-16 h-6 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : !activityLogs || activityLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity to display.</p>
              <p className="text-sm">Activity will appear here as users interact with the system.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activityLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className={`w-2 h-2 ${getActivityColor(log.action)} rounded-full mt-2 flex-shrink-0`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {log.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTimeAgo(log.createdAt)}
                      {log.metadata && typeof log.metadata === 'object' && 'location' in log.metadata && (
                        <span> • Location verified</span>
                      )}
                    </p>
                  </div>
                  {getStatusBadge(log.action)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
