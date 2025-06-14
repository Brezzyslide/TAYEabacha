import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Grid, List, Users, AlertTriangle, Archive, Edit, Settings } from "lucide-react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import AvailabilityCard from "./AvailabilityCard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StaffAvailability {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  availability: Record<string, string[]>;
  patternName?: string;
  isActive: boolean;
  overrideByManager: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConflictData {
  day: string;
  shiftType: string;
  staffCount: number;
  minRequired: number;
  isUnderStaffed: boolean;
}

export default function AdminAvailabilityDashboard() {
  const [activeView, setActiveView] = useState<"cards" | "list" | "calendar">("cards");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all staff availability
  const { data: staffAvailability = [], isLoading } = useQuery({
    queryKey: ["/api/manage-staff-availability", showArchived],
    queryFn: async () => {
      const response = await fetch(`/api/manage-staff-availability?archived=${showArchived}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch staff availability");
      return response.json();
    },
  });

  // Fetch conflict analysis
  const { data: conflicts = [] } = useQuery({
    queryKey: ["/api/staff-availability/conflicts"],
    queryFn: async () => {
      const response = await fetch("/api/staff-availability/conflicts", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch conflicts");
      return response.json();
    },
  });

  // Archive availability mutation
  const archiveAvailabilityMutation = useMutation({
    mutationFn: async (availabilityId: number) => {
      return await apiRequest(`/api/staff-availability/${availabilityId}/archive`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manage-staff-availability"] });
      toast({
        title: "Availability Archived",
        description: "Staff availability has been archived successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive availability.",
        variant: "destructive",
      });
    },
  });

  // Override availability mutation
  const overrideAvailabilityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest(`/api/staff-availability/${id}/override`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manage-staff-availability"] });
      toast({
        title: "Availability Modified",
        description: "Staff availability has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to modify availability.",
        variant: "destructive",
      });
    },
  });

  const handleArchive = (availabilityId: number) => {
    archiveAvailabilityMutation.mutate(availabilityId);
  };

  const handleOverride = (id: number, newAvailability: Record<string, string[]>) => {
    overrideAvailabilityMutation.mutate({
      id,
      data: { availability: newAvailability, overrideByManager: true }
    });
  };

  const activeStaff = staffAvailability.filter((staff: StaffAvailability) => staff.isActive);
  const archivedStaff = staffAvailability.filter((staff: StaffAvailability) => !staff.isActive);
  const displayStaff = showArchived ? archivedStaff : activeStaff;

  // Calculate coverage statistics
  const totalStaff = activeStaff.length;
  const availableToday = activeStaff.filter((staff: StaffAvailability) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    return staff.availability[today]?.length > 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalStaff}</p>
                <p className="text-sm text-gray-600">Total Active Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{availableToday}</p>
                <p className="text-sm text-gray-600">Available Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{conflicts.length}</p>
                <p className="text-sm text-gray-600">Staffing Conflicts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Archive className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold">{archivedStaff.length}</p>
                <p className="text-sm text-gray-600">Archived Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <span>Staffing Conflicts Detected</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conflicts.map((conflict: ConflictData, index: number) => (
                <div key={index} className="flex justify-between items-center bg-white p-3 rounded border">
                  <div>
                    <span className="font-medium">{conflict.day} - {conflict.shiftType}</span>
                    <p className="text-sm text-gray-600">
                      {conflict.staffCount} staff available, {conflict.minRequired} required
                    </p>
                  </div>
                  <Badge variant="destructive">
                    -{conflict.minRequired - conflict.staffCount} staff
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Controls */}
      <div className="flex justify-between items-center">
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
          <TabsList>
            <TabsTrigger value="cards" className="flex items-center space-x-2">
              <Grid className="h-4 w-4" />
              <span>Card View</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center space-x-2">
              <List className="h-4 w-4" />
              <span>List View</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4" />
              <span>Calendar View</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex space-x-2">
          <Button
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived(!showArchived)}
            size="sm"
          >
            <Archive className="h-4 w-4 mr-2" />
            {showArchived ? "Show Active" : "Show Archived"}
          </Button>
        </div>
      </div>

      {/* Content based on active view */}
      {activeView === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayStaff.map((staff: StaffAvailability) => (
            <AvailabilityCard
              key={staff.id}
              staff={staff}
              onArchive={handleArchive}
              onOverride={handleOverride}
              showArchived={showArchived}
            />
          ))}
        </div>
      )}

      {activeView === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>Staff Availability List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {displayStaff.map((staff: StaffAvailability) => (
                <div key={staff.id} className="flex justify-between items-center p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{staff.userName}</span>
                      <Badge variant="outline">{staff.userRole}</Badge>
                      {staff.overrideByManager && (
                        <Badge variant="secondary">
                          <Settings className="h-3 w-3 mr-1" />
                          Modified
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Available: {Object.keys(staff.availability).length} days
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleArchive(staff.id)}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === "calendar" && (
        <AvailabilityCalendar
          staffAvailability={displayStaff}
          conflicts={conflicts}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      )}

      {displayStaff.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {showArchived ? "No archived availability records found" : "No active staff availability found"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}