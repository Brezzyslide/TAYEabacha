import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserRound, FileText, TrendingUp, ArrowUp, Clock, TriangleAlert, Download } from "lucide-react";

interface DashboardStats {
  activeClients: number;
  staffOnDuty: number;
  formsCompleted: number;
  formsPending: number;
  totalStaff: number;
  totalSubmissions: number;
}

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: "Active Clients",
      value: stats?.activeClients || 0,
      subtitle: "+12 this week",
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      subtitleIcon: ArrowUp,
      subtitleColor: "text-green-600"
    },
    {
      title: "Staff On Duty",
      value: stats?.staffOnDuty || 0,
      subtitle: "8 checked in today",
      icon: UserRound,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      subtitleIcon: Clock,
      subtitleColor: "text-blue-600"
    },
    {
      title: "Forms Completed",
      value: stats?.formsCompleted || 0,
      subtitle: `${stats?.formsPending || 0} pending`,
      icon: FileText,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      subtitleIcon: TriangleAlert,
      subtitleColor: "text-orange-600"
    },
    {
      title: "Data Exports",
      value: 28,
      subtitle: "Last: 2 hours ago",
      icon: TrendingUp,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      subtitleIcon: Download,
      subtitleColor: "text-gray-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat, index) => (
        <Card key={index} className="border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className={`text-sm mt-1 flex items-center ${stat.subtitleColor}`}>
                  <stat.subtitleIcon className="h-4 w-4 mr-1" />
                  {stat.subtitle}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
