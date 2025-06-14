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
      onClick: () => navigate("/clients")
    },
    {
      title: "Start Shift",
      description: "Begin shift logging",
      icon: Play,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      onClick: () => navigate("/shifts")
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
      title: "Export Data",
      description: "Download CSV reports",
      icon: Download,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      onClick: () => navigate("/export")
    }
  ];

  return (
    <div className="lg:col-span-1">
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start p-3 h-auto border border-gray-200 hover:bg-gray-50"
                onClick={action.onClick}
              >
                <div className={`w-10 h-10 ${action.iconBg} rounded-lg flex items-center justify-center mr-3 flex-shrink-0`}>
                  <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{action.title}</p>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
