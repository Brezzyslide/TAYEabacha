import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Play, Plus, Download, AlertTriangle, BarChart3 } from "lucide-react";

export default function QuickActions() {
  const [, navigate] = useLocation();

  const quickActions = [
    {
      title: "Workflow Dashboard",
      description: "View insights & manage tasks",
      icon: BarChart3,
      iconBg: "bg-gradient-to-r from-blue-100 to-purple-100",
      iconColor: "text-blue-600",
      onClick: () => navigate("/workflow-dashboard"),
      featured: true
    },
    {
      title: "Add New Client",
      description: "Create client profile",
      icon: UserPlus,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      onClick: () => navigate("/clients/create")
    },
    {
      title: "Start Shift",
      description: "Begin shift logging",
      icon: Play,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      onClick: () => navigate("/shift")
    },
    {
      title: "Incident Report",
      description: "Report incident",
      icon: AlertTriangle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      onClick: () => navigate("/incident-management")
    },
    {
      title: "View All Clients",
      description: "Browse client list",
      icon: Download,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      onClick: () => navigate("/clients")
    }
  ];

  return (
    <div className="lg:col-span-1">
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start p-2 h-auto border border-gray-200 hover:bg-gray-50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Quick action clicked:', action.title);
                  action.onClick();
                }}
              >
                <div className={`w-8 h-8 ${action.iconBg} rounded-lg flex items-center justify-center mr-3 flex-shrink-0`}>
                  <action.icon className={`h-4 w-4 ${action.iconColor}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm text-gray-900">{action.title}</p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
