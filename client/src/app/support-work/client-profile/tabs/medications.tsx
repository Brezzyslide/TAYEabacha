import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Pill, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface MedicationsTabProps {
  clientId: string;
  companyId: string;
}

export default function MedicationsTab({ clientId, companyId }: MedicationsTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();

  const { data: medicationData, isLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/medications`, companyId],
    queryFn: () => Promise.resolve({
      activeMedications: [
        {
          id: 1,
          name: "Fluoxetine",
          dosage: "20mg",
          frequency: "Once daily",
          timeOfDay: "Morning",
          startDate: "2024-01-15",
          endDate: null,
          prescribedBy: "Dr. Sarah Williams",
          instructions: "Take with food",
          sideEffects: ["Nausea", "Drowsiness"],
          status: "Active"
        },
        {
          id: 2,
          name: "Metformin",
          dosage: "500mg",
          frequency: "Twice daily",
          timeOfDay: "Morning, Evening",
          startDate: "2024-02-01",
          endDate: null,
          prescribedBy: "Dr. Michael Chen",
          instructions: "Take with meals",
          sideEffects: ["Stomach upset"],
          status: "Active"
        },
        {
          id: 3,
          name: "Vitamin D3",
          dosage: "1000IU",
          frequency: "Once daily",
          timeOfDay: "Morning",
          startDate: "2024-03-01",
          endDate: null,
          prescribedBy: "Dr. Sarah Williams",
          instructions: "Can be taken with or without food",
          sideEffects: [],
          status: "Active"
        }
      ],
      administrationLogs: [
        {
          id: 1,
          medicationId: 1,
          medicationName: "Fluoxetine 20mg",
          dateTime: "2024-06-13T09:00:00Z",
          administeredBy: "Jane Smith",
          status: "Administered",
          notes: "Client took medication without issues"
        },
        {
          id: 2,
          medicationId: 2,
          medicationName: "Metformin 500mg",
          dateTime: "2024-06-13T08:30:00Z",
          administeredBy: "Jane Smith",
          status: "Administered",
          notes: "Taken with breakfast"
        },
        {
          id: 3,
          medicationId: 1,
          medicationName: "Fluoxetine 20mg",
          dateTime: "2024-06-12T09:15:00Z",
          administeredBy: "Tom Wilson",
          status: "Administered",
          notes: ""
        },
        {
          id: 4,
          medicationId: 2,
          medicationName: "Metformin 500mg",
          dateTime: "2024-06-12T20:00:00Z",
          administeredBy: "Sarah Brown",
          status: "Missed",
          notes: "Client refused medication"
        }
      ],
      adherenceStats: {
        overall: 92,
        thisWeek: 96,
        thisMonth: 89,
        byMedication: [
          { name: "Fluoxetine", adherence: 98 },
          { name: "Metformin", adherence: 87 },
          { name: "Vitamin D3", adherence: 91 }
        ]
      }
    })
  });

  if (isLoading) {
    return <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  const data = medicationData!;

  return (
    <div className="space-y-6">
      {/* Export Actions */}
      <div className="flex gap-2">
        <Button onClick={() => console.log("Exporting medication plan to PDF...")}>
          <Download className="w-4 h-4 mr-2" />
          Export Plan (PDF)
        </Button>
        <Button variant="outline" onClick={() => console.log("Exporting administration logs...")}>
          <Download className="w-4 h-4 mr-2" />
          Export Logs
        </Button>
      </div>

      <Tabs defaultValue="plan" className="w-full">
        <TabsList>
          <TabsTrigger value="plan">Medication Plan</TabsTrigger>
          <TabsTrigger value="logs">Administration Logs</TabsTrigger>
          <TabsTrigger value="analytics">Adherence Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4">
          <div className="grid gap-4">
            {data.activeMedications.map((medication) => (
              <Card key={medication.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Pill className="w-5 h-5" />
                      {medication.name} {medication.dosage}
                    </CardTitle>
                    <Badge variant="outline">{medication.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="font-medium">Frequency</p>
                      <p className="text-sm text-muted-foreground">{medication.frequency}</p>
                    </div>
                    <div>
                      <p className="font-medium">Time of Day</p>
                      <p className="text-sm text-muted-foreground">{medication.timeOfDay}</p>
                    </div>
                    <div>
                      <p className="font-medium">Prescribed By</p>
                      <p className="text-sm text-muted-foreground">{medication.prescribedBy}</p>
                    </div>
                    <div>
                      <p className="font-medium">Start Date</p>
                      <p className="text-sm text-muted-foreground">{medication.startDate}</p>
                    </div>
                    <div>
                      <p className="font-medium">Instructions</p>
                      <p className="text-sm text-muted-foreground">{medication.instructions}</p>
                    </div>
                    <div>
                      <p className="font-medium">Side Effects</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {medication.sideEffects.length > 0 ? (
                          medication.sideEffects.map((effect, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {effect}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">None reported</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedDate && (
              <Button variant="ghost" onClick={() => setSelectedDate(undefined)}>
                Clear filter
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {data.administrationLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">{log.medicationName}</span>
                      <Badge variant={log.status === "Administered" ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(log.dateTime), "PPp")}
                    </span>
                  </div>
                  <div className="text-sm">
                    <p><strong>Administered by:</strong> {log.administeredBy}</p>
                    {log.notes && <p><strong>Notes:</strong> {log.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Overall Adherence Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold">{data.adherenceStats.overall}%</div>
                <p className="text-sm text-muted-foreground">Overall Adherence</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">{data.adherenceStats.thisWeek}%</div>
                <p className="text-sm text-muted-foreground">This Week</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-2xl font-bold">{data.adherenceStats.thisMonth}%</div>
                <p className="text-sm text-muted-foreground">This Month</p>
              </CardContent>
            </Card>
          </div>

          {/* By Medication Adherence */}
          <Card>
            <CardHeader>
              <CardTitle>Adherence by Medication</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.adherenceStats.byMedication.map((med, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{med.name}</span>
                      <span className="text-sm">{med.adherence}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${med.adherence}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}