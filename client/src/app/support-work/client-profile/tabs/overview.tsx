import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, AlertTriangle, Pill } from "lucide-react";

interface OverviewTabProps {
  clientId: string;
  companyId: string;
}

export default function OverviewTab({ clientId, companyId }: OverviewTabProps) {
  // Mock data - replace with actual API calls
  const { data: clientOverview, isLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/overview`, companyId],
    queryFn: () => Promise.resolve({
      personalInfo: {
        name: "Sarah Johnson",
        ndisNumber: "43000012345",
        dateOfBirth: "1985-03-15",
        address: "123 Oak Street, Melbourne VIC 3000",
        phone: "0412 345 678",
        emergencyContact: "John Johnson - 0498 765 432",
        primaryDisability: "Intellectual Disability",
        supportNeeds: "Daily living skills, community access"
      },
      currentStatus: {
        planStatus: "Active",
        planStart: "2024-01-01",
        planEnd: "2024-12-31",
        totalBudget: 45000,
        budgetUsed: 28750,
        budgetRemaining: 16250
      },
      recentActivity: [
        { type: "medication", description: "Medication administered - Fluoxetine 20mg", date: "2024-06-12", time: "09:00" },
        { type: "incident", description: "Minor fall in bathroom - no injury", date: "2024-06-11", time: "14:30", severity: "low" },
        { type: "note", description: "Client attended community outing", date: "2024-06-11", time: "10:00" },
        { type: "schedule", description: "Support worker shift completed", date: "2024-06-10", time: "16:00" }
      ],
      quickStats: {
        activeMedications: 3,
        upcomingAppointments: 2,
        openIncidents: 0,
        completedGoals: 8
      }
    })
  });

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="space-y-2">
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

  const overview = clientOverview!;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-lg">
              <Pill className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{overview.quickStats.activeMedications}</div>
            <p className="text-sm text-muted-foreground">Active Medications</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-green-100 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold">{overview.quickStats.upcomingAppointments}</div>
            <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="text-2xl font-bold">{overview.quickStats.openIncidents}</div>
            <p className="text-sm text-muted-foreground">Open Incidents</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{overview.quickStats.completedGoals}</div>
            <p className="text-sm text-muted-foreground">Completed Goals</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">Date of Birth:</span>
              <span className="ml-2">{overview.personalInfo.dateOfBirth}</span>
            </div>
            <div>
              <span className="font-medium">Address:</span>
              <span className="ml-2">{overview.personalInfo.address}</span>
            </div>
            <div>
              <span className="font-medium">Phone:</span>
              <span className="ml-2">{overview.personalInfo.phone}</span>
            </div>
            <div>
              <span className="font-medium">Emergency Contact:</span>
              <span className="ml-2">{overview.personalInfo.emergencyContact}</span>
            </div>
            <div>
              <span className="font-medium">Primary Disability:</span>
              <span className="ml-2">{overview.personalInfo.primaryDisability}</span>
            </div>
            <div>
              <span className="font-medium">Support Needs:</span>
              <span className="ml-2">{overview.personalInfo.supportNeeds}</span>
            </div>
          </CardContent>
        </Card>

        {/* NDIS Plan Status */}
        <Card>
          <CardHeader>
            <CardTitle>NDIS Plan Status</CardTitle>
            <Badge variant="outline" className="w-fit">{overview.currentStatus.planStatus}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">Plan Period:</span>
              <span className="ml-2">{overview.currentStatus.planStart} - {overview.currentStatus.planEnd}</span>
            </div>
            <div>
              <span className="font-medium">Total Budget:</span>
              <span className="ml-2">${overview.currentStatus.totalBudget.toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium">Budget Used:</span>
              <span className="ml-2">${overview.currentStatus.budgetUsed.toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium">Remaining:</span>
              <span className="ml-2 text-green-600">${overview.currentStatus.budgetRemaining.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${(overview.currentStatus.budgetUsed / overview.currentStatus.totalBudget) * 100}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {overview.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-4 p-3 border rounded-lg">
                <div className={`w-3 h-3 rounded-full mt-2 ${
                  activity.type === 'medication' ? 'bg-blue-500' :
                  activity.type === 'incident' ? 'bg-red-500' :
                  activity.type === 'note' ? 'bg-green-500' : 'bg-purple-500'
                }`} />
                <div className="flex-1">
                  <p className="font-medium">{activity.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {activity.date} at {activity.time}
                    {activity.severity && (
                      <Badge variant="outline" className="ml-2">{activity.severity} severity</Badge>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={() => console.log("Exporting overview to PDF...")}>
              Export Overview (PDF)
            </Button>
            <Button variant="outline" onClick={() => console.log("Exporting summary...")}>
              Export Summary
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}