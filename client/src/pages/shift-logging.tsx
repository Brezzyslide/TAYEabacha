import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Play, Square, Clock, Users, Shield } from "lucide-react";
import { type Shift } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import ShiftControls from "@/components/shifts/shift-controls";

export default function ShiftLogging() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const { toast } = useToast();

  const { data: shifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const startShiftMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/shifts/start", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Started",
        description: "Your shift has been logged successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const endShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      const res = await apiRequest("POST", `/api/shifts/${shiftId}/end`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Ended",
        description: "Your shift has been completed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Request location permission on component mount
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setLocationError("");
        },
        (error) => {
          let errorMessage = "";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied. Please enable location services.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
            default:
              errorMessage = "An unknown error occurred.";
              break;
          }
          setLocationError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, []);

  const handleStartShift = () => {
    if (!location) {
      toast({
        title: "Location Required",
        description: "Location verification is required to start a shift",
        variant: "destructive",
      });
      return;
    }

    startShiftMutation.mutate({
      latitude: location.latitude,
      longitude: location.longitude,
      location: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
      building,
      floor,
    });
  };

  const activeShifts = shifts?.filter(shift => shift.isActive) || [];
  const completedShifts = shifts?.filter(shift => !shift.isActive) || [];

  const getShiftDuration = (startTime: Date, endTime?: Date | null) => {
    const start = startTime instanceof Date ? startTime : new Date(startTime);
    const end = endTime ? (endTime instanceof Date ? endTime : new Date(endTime)) : new Date();
    const duration = end.getTime() - start.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Start New Shift</h1>
              <p className="text-gray-600 mt-1">Begin an unscheduled shift with geolocation verification and compliance documentation</p>
              <div className="mt-3 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Shield className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Compliance Ready:</strong> This creates a geolocation-verified shift record with audit trail for NDIS compliance. 
                      Use for emergency cover, unplanned client needs, or additional support outside scheduled shifts.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Location Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Location Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locationError ? (
                  <div className="flex items-center space-x-2 text-red-600">
                    <MapPin className="h-4 w-4" />
                    <span>{locationError}</span>
                  </div>
                ) : location ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-green-600">
                      <MapPin className="h-4 w-4" />
                      <span>Location verified</span>
                      <Badge variant="default">Accurate to {Math.round(location.accuracy)}m</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-yellow-600">
                    <MapPin className="h-4 w-4" />
                    <span>Requesting location...</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shift Controls */}
            <ShiftControls 
              location={location}
              onStartShift={handleStartShift}
              startShiftMutation={startShiftMutation}
              building={building}
              setBuilding={setBuilding}
              floor={floor}
              setFloor={setFloor}
            />

            {/* Active Shifts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Active Shifts</span>
                  <Badge variant="default">{activeShifts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading shifts...</div>
                ) : activeShifts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No active shifts. Start a shift to begin tracking.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeShifts.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <div>
                            <p className="font-medium">
                              Started at {new Date(shift.startTime).toLocaleTimeString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              {shift.building && `${shift.building} • `}
                              {shift.floor && `Floor ${shift.floor} • `}
                              Duration: {getShiftDuration(shift.startTime, shift.endTime || undefined)}
                            </p>
                            {shift.location && (
                              <p className="text-xs text-gray-400">
                                Location: {shift.location}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => endShiftMutation.mutate(shift.id)}
                          disabled={endShiftMutation.isPending}
                        >
                          <Square className="h-4 w-4 mr-2" />
                          End Shift
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Completed Shifts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Completed Shifts</CardTitle>
              </CardHeader>
              <CardContent>
                {completedShifts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No completed shifts to display.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {completedShifts.slice(0, 10).map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <p className="font-medium">
                            {new Date(shift.startTime).toLocaleDateString()} • {getShiftDuration(shift.startTime, shift.endTime || undefined)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(shift.startTime).toLocaleTimeString()} - {shift.endTime ? new Date(shift.endTime).toLocaleTimeString() : "Ongoing"}
                          </p>
                          {shift.building && (
                            <p className="text-sm text-gray-500">
                              {shift.building} {shift.floor && `• Floor ${shift.floor}`}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">Completed</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
