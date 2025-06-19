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
        <Card key={index} className="modern-card group hover:scale-105 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200 uppercase tracking-wider">{stat.title}</p>
                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                <p className={`text-sm mt-3 flex items-center text-slate-300 font-medium`}>
                  <stat.subtitleIcon className="h-4 w-4 mr-2" />
                  {stat.subtitle}
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                <div className="relative w-14 h-14 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-all duration-300">
                  <stat.icon className="h-7 w-7 text-white" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
