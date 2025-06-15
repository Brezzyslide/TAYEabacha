import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Plus, Calendar, Target } from "lucide-react";
import { format } from "date-fns";

interface CarePlansTabProps {
  clientId: string;
  companyId: string;
}

export default function CarePlansTab({ clientId, companyId }: CarePlansTabProps) {
  const { data: carePlansData, isLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/care-plans`, companyId],
    queryFn: () => Promise.resolve({
      activePlans: [
        {
          id: 1,
          title: "Daily Living Skills Development",
          description: "Support client in developing independent living skills including cooking, cleaning, and personal hygiene",
          category: "Core Support",
          status: "Active",
          startDate: "2024-01-15",
          endDate: "2024-12-31",
          createdBy: "Dr. Sarah Williams",
          lastUpdated: "2024-06-01",
          goals: [
            {
              id: 1,
              description: "Prepare simple meals independently",
              targetDate: "2024-09-01",
              status: "In Progress",
              progress: 65
            },
            {
              id: 2,
              description: "Maintain personal hygiene routine",
              targetDate: "2024-07-01",
              status: "Completed",
              progress: 100
            },
            {
              id: 3,
              description: "Manage household cleaning tasks",
              targetDate: "2024-10-01",
              status: "In Progress",
              progress: 30
            }
          ],
          interventions: [
            "Weekly cooking sessions with support worker",
            "Daily hygiene reminders and assistance",
            "Structured cleaning schedule with visual aids"
          ]
        },
        {
          id: 2,
          title: "Community Access and Social Skills",
          description: "Enhance social participation and community engagement through structured activities",
          category: "Capacity Building",
          status: "Active",
          startDate: "2024-02-01",
          endDate: "2024-12-31",
          createdBy: "Jane Smith, OT",
          lastUpdated: "2024-05-15",
          goals: [
            {
              id: 4,
              description: "Attend community events independently",
              targetDate: "2024-08-01",
              status: "In Progress",
              progress: 45
            },
            {
              id: 5,
              description: "Develop peer relationships",
              targetDate: "2024-11-01",
              status: "In Progress",
              progress: 25
            }
          ],
          interventions: [
            "Weekly community outings",
            "Social skills group sessions",
            "Peer mentoring program participation"
          ]
        },
        {
          id: 3,
          title: "Health and Wellness Management",
          description: "Support medication compliance and health monitoring",
          category: "Health Support",
          status: "Active",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          createdBy: "Dr. Michael Chen",
          lastUpdated: "2024-06-10",
          goals: [
            {
              id: 6,
              description: "Maintain 95% medication adherence",
              targetDate: "2024-12-31",
              status: "On Track",
              progress: 92
            },
            {
              id: 7,
              description: "Regular health check-ups",
              targetDate: "2024-12-31",
              status: "On Track",
              progress: 80
            }
          ],
          interventions: [
            "Medication administration support",
            "Health monitoring and documentation",
            "Coordination with healthcare providers"
          ]
        }
      ]
    })
  });

  // Assume supportWorker role - create button should be disabled
  const userRole = "supportWorker";

  if (isLoading) {
    return <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  const data = carePlansData!;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Care Plans</h3>
        <div className="flex gap-2">
          <Button 
            disabled={userRole === "supportWorker"} 
            className="opacity-50 cursor-not-allowed"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Plan
          </Button>
          <Button onClick={() => console.log("Exporting care plans to PDF...")}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Care Plans List */}
      <div className="space-y-6">
        {data.activePlans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {plan.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{plan.category}</Badge>
                  <Badge variant="default">{plan.status}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Created by: {plan.createdBy}</span>
                <span>•</span>
                <span>Period: {format(new Date(plan.startDate), "MMM dd, yyyy")} - {format(new Date(plan.endDate), "MMM dd, yyyy")}</span>
                <span>•</span>
                <span>Last updated: {format(new Date(plan.lastUpdated), "MMM dd, yyyy")}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Goals Section */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Goals & Outcomes
                </h4>
                <div className="space-y-3">
                  {plan.goals.map((goal) => (
                    <div key={goal.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{goal.description}</p>
                        <Badge variant={
                          goal.status === "Completed" ? "default" :
                          goal.status === "On Track" ? "secondary" : "outline"
                        }>
                          {goal.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Target: {format(new Date(goal.targetDate), "MMM dd, yyyy")}
                        </span>
                        <span>Progress: {goal.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full ${
                            goal.progress === 100 ? "bg-green-600" :
                            goal.progress >= 50 ? "bg-blue-600" : "bg-orange-600"
                          }`}
                          style={{ width: `${goal.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interventions Section */}
              <div>
                <h4 className="font-medium mb-3">Key Interventions</h4>
                <ul className="space-y-2">
                  {plan.interventions.map((intervention, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-sm">{intervention}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                <Button variant="outline" size="sm" onClick={() => console.log(`Exporting plan ${plan.id}...`)}>
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Care Plan Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.activePlans.length}</div>
              <p className="text-sm text-muted-foreground">Active Plans</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.activePlans.reduce((acc, plan) => acc + plan.goals.length, 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total Goals</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {data.activePlans.reduce((acc, plan) => 
                  acc + plan.goals.filter(g => g.status === "Completed").length, 0
                )}
              </div>
              <p className="text-sm text-muted-foreground">Completed Goals</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(
                  data.activePlans.reduce((acc, plan) => 
                    acc + plan.goals.reduce((goalAcc, goal) => goalAcc + goal.progress, 0) / plan.goals.length, 0
                  ) / data.activePlans.length
                )}%
              </div>
              <p className="text-sm text-muted-foreground">Avg Progress</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}