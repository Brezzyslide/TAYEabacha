import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type Shift } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface StartShiftModalProps {
  shift: Shift;
  isOpen: boolean;
  onClose: () => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export default function StartShiftModal({ shift, isOpen, onClose }: StartShiftModalProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [handoverFromStaffId, setHandoverFromStaffId] = useState<string>("");
  const [handoverNotes, setHandoverNotes] = useState<string>("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Convert coordinates to readable address
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=YOUR_API_KEY`);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0].formatted;
        }
      }
    } catch (error) {
      console.warn("Geocoding failed:", error);
    }
    
    // Fallback to reverse geocoding using browser API or return coordinates
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    } catch (error) {
      console.warn("Nominatim geocoding failed:", error);
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  // Get current location when modal opens
  useEffect(() => {
    if (isOpen && !location) {
      setIsLoadingLocation(true);
      setLocationError("");

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const address = await getAddressFromCoordinates(latitude, longitude);
            setLocation({
              latitude,
              longitude,
              address
            });
            setIsLoadingLocation(false);
          },
          (error) => {
            setLocationError(`Location access denied: ${error.message}`);
            setIsLoadingLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      } else {
        setLocationError("Geolocation is not supported by this browser");
        setIsLoadingLocation(false);
      }
    }
  }, [isOpen, location]);

  const startShiftMutation = useMutation({
    mutationFn: async () => {
      console.log(`[AWS DEBUG - CLIENT] 🚀 Starting shift ${shift.id} for user ${user?.username}`);
      console.log(`[AWS DEBUG - CLIENT] Location data:`, location);
      console.log(`[AWS DEBUG - CLIENT] Handover notes:`, handoverNotes);
      console.log(`[AWS DEBUG - CLIENT] Handover from staff:`, handoverFromStaffId);

      // Validate mandatory handover notes
      if (!handoverNotes.trim()) {
        const error = new Error("Handover notes are required to start your shift");
        console.error(`[AWS DEBUG - CLIENT] ❌ Validation failed:`, error.message);
        throw error;
      }

      const updateData = {
        status: "in-progress",
        startTimestamp: new Date().toISOString(),
        startLocation: location ? `${location.latitude},${location.longitude}` : null,
        handoverReceivedFromStaffId: handoverFromStaffId ? parseInt(handoverFromStaffId) : null,
        handoverNotesIn: handoverNotes.trim()
      };

      console.log(`[AWS DEBUG - CLIENT] 📤 Sending update data:`, JSON.stringify(updateData, null, 2));
      console.log(`[AWS DEBUG - CLIENT] 🔗 API endpoint: PATCH /api/shifts/${shift.id}`);

      try {
        const result = await apiRequest("PATCH", `/api/shifts/${shift.id}`, updateData);
        console.log(`[AWS DEBUG - CLIENT] ✅ API response:`, JSON.stringify(result, null, 2));
        return result;
      } catch (error) {
        console.error(`[AWS DEBUG - CLIENT] ❌ API request failed:`, error);
        console.error(`[AWS DEBUG - CLIENT] ❌ Error details:`, {
          message: error.message,
          status: error.status,
          statusText: error.statusText
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log(`[AWS DEBUG - CLIENT] 🎉 Shift start successful:`, data);
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Started",
        description: "Your shift has been successfully started.",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      console.error(`[AWS DEBUG - CLIENT] ❌ Shift start failed:`, error);
      console.error(`[AWS DEBUG - CLIENT] ❌ Error details:`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        stack: error.stack
      });
      
      // Enhanced error message for debugging
      let errorMessage = error.message || "Failed to start shift. Please try again.";
      if (error.status) {
        errorMessage += ` (Status: ${error.status})`;
      }
      
      toast({
        title: "Error Starting Shift",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setHandoverFromStaffId("");
    setHandoverNotes("");
    setLocation(null);
    setLocationError("");
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No client assigned";
    const client = (clients as any[]).find(c => c.id === clientId);
    return client?.fullName || "Unknown client";
  };

  const getStaffOptions = () => {
    return (users as any[]).filter(u => u.id !== user?.id && u.tenantId === user?.tenantId);
  };

  const handleSubmit = () => {
    if (!location && !locationError) {
      toast({
        title: "Location Required",
        description: "Please wait for location detection to complete.",
        variant: "destructive",
      });
      return;
    }

    startShiftMutation.mutate();
  };

  const handleClose = () => {
    if (!startShiftMutation.isPending) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-600" />
            Start Shift
          </DialogTitle>
          <DialogDescription>
            Begin your shift with GPS verification and handover notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Shift Information */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-lg">{shift.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(shift.startTime), "MMMM d, yyyy")}
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span>
                    {format(new Date(shift.startTime), "h:mm a")} - {shift.endTime ? format(new Date(shift.endTime), "h:mm a") : "TBD"}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>{getClientName(shift.clientId)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Verification */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Current Location
            </Label>
            <Card>
              <CardContent className="p-3">
                {isLoadingLocation ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Detecting your location...
                  </div>
                ) : locationError ? (
                  <div className="text-sm text-red-600">
                    {locationError}
                  </div>
                ) : location ? (
                  <div className="text-sm text-green-600">
                    Location verified: {location.address}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Handover Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="handover-from">Receiving Handover From (Optional)</Label>
              <Select value={handoverFromStaffId} onValueChange={setHandoverFromStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {getStaffOptions().map((staff) => (
                    <SelectItem key={staff.id} value={staff.id.toString()}>
                      {staff.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handover-notes">
                What were you told during handover? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="handover-notes"
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Enter handover notes... (Required)"
                rows={4}
                className={!handoverNotes.trim() ? "border-red-300 focus:border-red-500" : ""}
              />
              {!handoverNotes.trim() && (
                <p className="text-sm text-red-600">Handover notes are required to start your shift</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={startShiftMutation.isPending || isLoadingLocation}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {startShiftMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                "Start Shift"
              )}
            </Button>
            
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={startShiftMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}