import { useState } from "react";
import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Download, 
  FileText, 
  Pill, 
  AlertTriangle, 
  Eye, 
  Clock,
  User,
  MapPin,
  Target,
  TrendingUp
} from "lucide-react";

export default function ClientProfileDemo() {
  const params = useParams();
  const clientId = params.clientId || "1";
  const [activeTab, setActiveTab] = useState("overview");

  // Mock client data
  const clientData = {
    id: clientId,
    name: "Sarah Johnson",
    ndisNumber: "43000012345",
    status: "Active",
    planType: "Core Support",
    dateOfBirth: "1985-03-15",
    address: "123 Oak Street, Melbourne VIC 3000"
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Client Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{clientData.name}</CardTitle>
              <p className="text-muted-foreground">NDIS: {clientData.ndisNumber}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{clientData.status}</Badge>
              <Badge variant="secondary">{clientData.planType}</Badge>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>DOB: {clientData.dateOfBirth}</p>
            <p>{clientData.address}</p>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="care-plans">Care Plans</TabsTrigger>
          <TabsTrigger value="case-notes">Case Notes</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="observations">Observations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-lg">
                  <Pill className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">3</div>
                <p className="text-sm text-muted-foreground">Active Medications</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-green-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold">2</div>
                <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div className="text-2xl font-bold">0</div>
                <p className="text-sm text-muted-foreground">Open Incidents</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-purple-100 rounded-lg">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-2xl font-bold">8</div>
                <p className="text-sm text-muted-foreground">Completed Goals</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Primary Disability:</span>
                  <span className="ml-2">Intellectual Disability</span>
                </div>
                <div>
                  <span className="font-medium">Support Needs:</span>
                  <span className="ml-2">Daily living skills, community access</span>
                </div>
                <div>
                  <span className="font-medium">Emergency Contact:</span>
                  <span className="ml-2">John Johnson - 0498 765 432</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>NDIS Plan Status</CardTitle>
                <Badge variant="outline" className="w-fit">Active</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Plan Period:</span>
                  <span className="ml-2">2024-01-01 - 2024-12-31</span>
                </div>
                <div>
                  <span className="font-medium">Total Budget:</span>
                  <span className="ml-2">$45,000</span>
                </div>
                <div>
                  <span className="font-medium">Budget Used:</span>
                  <span className="ml-2">$28,750</span>
                </div>
                <div>
                  <span className="font-medium">Remaining:</span>
                  <span className="ml-2 text-green-600">$16,250</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: "64%" }}></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="medications" className="mt-6">
          <div className="flex gap-2 mb-4">
            <Button onClick={() => console.log("Exporting medication plan...")}>
              <Download className="w-4 h-4 mr-2" />
              Export Plan (PDF)
            </Button>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="w-5 h-5" />
                  Fluoxetine 20mg
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium">Frequency</p>
                    <p className="text-sm text-muted-foreground">Once daily</p>
                  </div>
                  <div>
                    <p className="font-medium">Time of Day</p>
                    <p className="text-sm text-muted-foreground">Morning</p>
                  </div>
                  <div>
                    <p className="font-medium">Prescribed By</p>
                    <p className="text-sm text-muted-foreground">Dr. Sarah Williams</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adherence Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">92%</div>
                    <p className="text-sm text-muted-foreground">Overall</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">96%</div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">89%</div>
                    <p className="text-sm text-muted-foreground">This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="care-plans" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Care Plans</h3>
            <div className="flex gap-2">
              <Button disabled className="opacity-50 cursor-not-allowed">
                Create Plan (Admin Only)
              </Button>
              <Button onClick={() => console.log("Exporting care plans...")}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Daily Living Skills Development
              </CardTitle>
              <Badge variant="outline">Core Support</Badge>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Support client in developing independent living skills including cooking, cleaning, and personal hygiene</p>
              <div className="space-y-3">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Prepare simple meals independently</p>
                    <Badge variant="secondary">In Progress</Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: "65%" }}></div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Progress: 65%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="case-notes" className="mt-6">
          <div className="flex gap-2 mb-4">
            <Button onClick={() => console.log("Exporting case notes...")}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Progress Review</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-3 h-3" />
                <span>Jane Smith (Support Worker)</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>Jun 13, 2024 at 10:30</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Client has shown significant improvement in daily living skills this week. Successfully prepared breakfast independently for 3 consecutive days.</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">progress</Badge>
                <Badge variant="outline">daily-living</Badge>
                <Badge variant="outline">independence</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="mt-6">
          <div className="flex gap-2 mb-4">
            <Button onClick={() => console.log("Exporting incidents...")}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                Minor Fall in Bathroom
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">LOW</Badge>
                <Badge variant="default">Resolved</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Client slipped on wet floor in bathroom. No visible injuries sustained. Client was able to get up independently.</p>
              <div className="text-sm">
                <p><strong>Reported by:</strong> Sarah Brown</p>
                <p><strong>Date:</strong> Jun 11, 2024 at 14:30</p>
                <p><strong>Location:</strong> Bathroom</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="mt-6">
          <div className="flex gap-2 mb-4">
            <Button onClick={() => console.log("Exporting schedule...")}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">09:00 - 13:00 (4h)</span>
                    <Badge variant="default">Completed</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Jane Smith
                    </p>
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Client Home
                    </p>
                    <p>Morning Support</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">7</div>
                    <p className="text-sm text-muted-foreground">Total Shifts</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">2</div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="observations" className="mt-6">
          <div className="flex gap-2 mb-4">
            <Button onClick={() => console.log("Exporting observations...")}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>

          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Improved Social Interaction
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="default">Positive</Badge>
                <Badge variant="default">High Significance</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Client actively engaged in conversation with peers during group activity. Initiated discussion about favorite movies and showed genuine interest in others' responses.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-sm mb-1">Observed Outcomes:</p>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      Increased confidence in social settings
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      Better peer relationships
                    </li>
                  </ul>
                </div>
                <div className="text-sm">
                  <p><strong>Observer:</strong> Jane Smith</p>
                  <p><strong>Context:</strong> Community center group activity</p>
                  <p><strong>Duration:</strong> 45 minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Export All Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Export comprehensive client profile including all tabs for external reporting or backup purposes.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => console.log("Exporting complete profile...")}>
              <Download className="w-4 h-4 mr-2" />
              Complete Profile (PDF)
            </Button>
            <Button variant="outline" onClick={() => console.log("Exporting data...")}>
              <Download className="w-4 h-4 mr-2" />
              Data Export (Excel)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}