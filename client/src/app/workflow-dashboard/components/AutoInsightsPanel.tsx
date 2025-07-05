import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkflowInsights } from "../hooks/useWorkflowInsights";
import { useLocation } from "wouter";
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  Calendar,
  Pill,
  FileText,
  TrendingUp,
  CheckCircle
} from "lucide-react";

export default function AutoInsightsPanel() {
  const { insights, isLoading } = useWorkflowInsights();
  const [, setLocation] = useLocation();

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'schedule':
        setLocation('/shift');
        break;
      case 'medication':
        setLocation('/medication-dashboard');
        break;
      case 'observations':
        setLocation('/hourly-observations');
        break;
      case 'incidents':
        setLocation('/incident-management');
        break;
      case 'case-notes':
        setLocation('/case-notes');
        break;
      case 'staff-hours':
        setLocation('/staff-hour-allocation');
        break;
      default:
        console.log('Quick action not implemented:', action);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const insightCards = [
    {
      title: "Medication Due Today",
      value: insights.medicationsDueToday,
      icon: Pill,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-200",
      description: "medications require administration"
    },
    {
      title: "Overdue Observations",
      value: insights.overdueObservations,
      icon: Clock,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200",
      description: "observations are past due"
    },
    {
      title: "Staff Coverage Gaps",
      value: insights.staffCoverageGaps,
      icon: Users,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 border-yellow-200",
      description: "shifts need coverage"
    },
    {
      title: "Pending Incidents",
      value: insights.pendingIncidents,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200",
      description: "incidents await closure"
    },
    {
      title: "Case Notes Due",
      value: insights.caseNotesDue,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
      description: "clients need updates"
    },
    {
      title: "Budget Utilization",
      value: `${insights.budgetUtilization}%`,
      icon: TrendingUp,
      color: insights.budgetUtilization > 90 ? "text-red-600" : insights.budgetUtilization > 75 ? "text-yellow-600" : "text-green-600",
      bgColor: insights.budgetUtilization > 90 ? "bg-red-50 border-red-200" : insights.budgetUtilization > 75 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200",
      description: "of allocated hours used"
    }
  ];

  const priorityInsights = insightCards.filter(card => 
    (typeof card.value === 'number' && card.value > 0) || 
    (typeof card.value === 'string' && card.value !== '0%')
  );

  return (
    <div className="space-y-6">
      {/* Priority Alerts */}
      {priorityInsights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Priority Insights</h3>
            <Badge variant="secondary">{priorityInsights.length} items need attention</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {priorityInsights.map((insight, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2">
                  <insight.icon className={`h-4 w-4 ${insight.color}`} />
                  <span className="font-medium text-sm">{insight.title}</span>
                </div>
                <div className="mt-1">
                  <span className={`text-lg font-bold ${insight.color}`}>{insight.value}</span>
                  <span className="text-xs text-gray-600 ml-1">{insight.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Insights Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">System Overview</h3>
          <Badge variant="outline">Last updated: just now</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insightCards.map((insight, index) => (
            <Card key={index} className={`transition-all hover:shadow-md ${insight.bgColor}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <insight.icon className={`h-4 w-4 ${insight.color}`} />
                    <span>{insight.title}</span>
                  </div>
                  {(typeof insight.value === 'number' && insight.value === 0) && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className={`text-2xl font-bold ${insight.color}`}>
                    {insight.value}
                  </div>
                  <p className="text-xs text-gray-600">
                    {insight.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleQuickAction('schedule')}>
              View Today's Schedule
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction('medication')}>
              Medication Administration
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction('observations')}>
              Complete Observations
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction('incidents')}>
              Review Incidents
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction('case-notes')}>
              Update Case Notes
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction('staff-hours')}>
              Staff Hour Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}