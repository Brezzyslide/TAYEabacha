import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, TrendingUp, Users, FileText } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function Reports() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activityLogs } = useQuery({
    queryKey: ["/api/activity-logs"],
  });

  // Calculate some basic metrics
  const today = new Date();
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const getActivityThisWeek = () => {
    if (!activityLogs) return 0;
    return (activityLogs as any[]).filter(log => 
      new Date(log.createdAt) >= thisWeek
    ).length;
  };

  const getActivityThisMonth = () => {
    if (!activityLogs) return 0;
    return (activityLogs as any[]).filter(log => 
      new Date(log.createdAt) >= thisMonth
    ).length;
  };

  const getActivityByType = () => {
    if (!activityLogs) return {};
    const types = {} as Record<string, number>;
    (activityLogs as any[]).forEach(log => {
      types[log.action] = (types[log.action] || 0) + 1;
    });
    return types;
  };

  const activityByType = getActivityByType();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-gray-600 mt-1">View insights and metrics for your care management system</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Clients</p>
                      <p className="text-3xl font-bold text-gray-900">{stats?.activeClients || 0}</p>
                      <p className="text-sm text-green-600 mt-1">
                        <TrendingUp className="h-4 w-4 inline mr-1" />
                        Total managed
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Staff On Duty</p>
                      <p className="text-3xl font-bold text-gray-900">{stats?.staffOnDuty || 0}</p>
                      <p className="text-sm text-blue-600 mt-1">
                        <CalendarDays className="h-4 w-4 inline mr-1" />
                        Currently active
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Users className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Forms Completed</p>
                      <p className="text-3xl font-bold text-gray-900">{stats?.formsCompleted || 0}</p>
                      <p className="text-sm text-orange-600 mt-1">
                        <FileText className="h-4 w-4 inline mr-1" />
                        {stats?.formsPending || 0} pending
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Activity</p>
                      <p className="text-3xl font-bold text-gray-900">{(activityLogs as any[])?.length || 0}</p>
                      <p className="text-sm text-indigo-600 mt-1">
                        <TrendingUp className="h-4 w-4 inline mr-1" />
                        All time
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activity Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-blue-900">This Week</p>
                        <p className="text-sm text-blue-600">Activity count</p>
                      </div>
                      <div className="text-2xl font-bold text-blue-900">
                        {getActivityThisWeek()}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-900">This Month</p>
                        <p className="text-sm text-green-600">Activity count</p>
                      </div>
                      <div className="text-2xl font-bold text-green-900">
                        {getActivityThisMonth()}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-purple-900">All Time</p>
                        <p className="text-sm text-purple-600">Total activity</p>
                      </div>
                      <div className="text-2xl font-bold text-purple-900">
                        {(activityLogs as any[])?.length || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Activity Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(activityByType).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-primary rounded-full"></div>
                          <span className="capitalize font-medium">{action.replace('_', ' ')}</span>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                    
                    {Object.keys(activityByType).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No activity data available yet.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Overview */}
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{stats?.totalStaff || 0}</div>
                    <div className="text-sm text-gray-600">Total Staff</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{stats?.totalSubmissions || 0}</div>
                    <div className="text-sm text-gray-600">Form Submissions</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.formsCompleted && stats?.totalSubmissions 
                        ? Math.round((stats.formsCompleted / stats.totalSubmissions) * 100) 
                        : 0}%
                    </div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.staffOnDuty && stats?.totalStaff
                        ? Math.round((stats.staffOnDuty / stats.totalStaff) * 100)
                        : 0}%
                    </div>
                    <div className="text-sm text-gray-600">Staff Utilization</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Export Note */}
            <Card>
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Need detailed reports? Visit the Export page to download comprehensive data in CSV format.
                </p>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">✓ Client data</Badge>
                  <Badge variant="outline">✓ Activity logs</Badge>
                  <Badge variant="outline">✓ Form submissions</Badge>
                  <Badge variant="outline">✓ Shift records</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
