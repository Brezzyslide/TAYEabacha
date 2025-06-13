import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Play, Plus, Download } from "lucide-react";

export default function QuickActions() {
  const [, navigate] = useLocation();

  const quickActions = [
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
      title: "Create Form",
      description: "Build dynamic form",
      icon: Plus,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      onClick: () => navigate("/forms")
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
