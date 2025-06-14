import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Clock, 
  AlertTriangle, 
  Pill, 
  FileText, 
  Users, 
  CheckCircle,
  Info
} from "lucide-react";
import { useWorkflowInsights } from "../hooks/useWorkflowInsights";

const iconMap = {
  Clock,
  AlertTriangle,
  Pill,
  FileText,
  Users,
  CheckCircle,
  Info
};

export default function AutoInsightsPanel() {
  const { insights, isLoading } = useWorkflowInsights();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            All Clear!
          </h3>
          <p className="text-gray-500 text-center max-w-md">
            No workflow alerts detected. Your system is running smoothly with no urgent issues requiring attention.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {insights.map((insight) => {
        const IconComponent = iconMap[insight.icon as keyof typeof iconMap] || Info;
        const borderColor = {
          error: 'border-red-200 dark:border-red-800',
          warning: 'border-yellow-200 dark:border-yellow-800',
          info: 'border-blue-200 dark:border-blue-800'
        }[insight.type];

        const badgeVariant = {
          error: 'destructive' as const,
          warning: 'secondary' as const,
          info: 'default' as const
        }[insight.type];

        return (
          <Card key={insight.id} className={`${borderColor} border-l-4`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                {insight.title}
              </CardTitle>
              <Badge variant={badgeVariant} className="text-xs">
                {insight.count}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {insight.description}
              </p>
              {insight.actionUrl && insight.actionLabel && (
                <Link href={insight.actionUrl}>
                  <Button size="sm" variant="outline" className="w-full">
                    {insight.actionLabel}
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}