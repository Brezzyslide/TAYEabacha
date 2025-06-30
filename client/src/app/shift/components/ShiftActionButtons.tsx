import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play, Square, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { type Shift } from "@shared/schema";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
}

interface ShiftActionButtonsProps {
  shift: Shift;
}

export default function ShiftActionButtons({ shift }: ShiftActionButtonsProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isUserShift = shift.userId === user?.id;
  
  // Check if shift can be started (5-minute rule)
  const canStartBasedOnTime = () => {
    if (!shift.startTime) return false;
    const shiftStartTime = new Date(shift.startTime);
    const now = new Date();
    const fiveMinutesBeforeStart = new Date(shiftStartTime.getTime() - 5 * 60 * 1000);
    return now >= fiveMinutesBeforeStart;
  };
  
  const canStartShift = !shift.isActive && shift.userId && isUserShift && canStartBasedOnTime();
  const canEndShift = shift.isActive && isUserShift;
  
  // Calculate time until shift can be started
  const getTimeUntilStartAllowed = () => {
    if (!shift.startTime) return null;
    const shiftStartTime = new Date(shift.startTime);
    const now = new Date();
    const fiveMinutesBeforeStart = new Date(shiftStartTime.getTime() - 5 * 60 * 1000);
    
    if (now >= fiveMinutesBeforeStart) return null;
    
    const timeDiff = fiveMinutesBeforeStart.getTime() - now.getTime();
    const minutes = Math.ceil(timeDiff / (1000 * 60));
    return minutes;
  };

  // Convert coordinates to readable address
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
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

  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }

      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const address = await getAddressFromCoordinates(latitude, longitude);
          setIsGettingLocation(false);
          resolve({
            latitude,
            longitude,
            accuracy,
            address,
          });
        },
        (error) => {
          setIsGettingLocation(false);
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  };

  // Start shift mutation
  const startShiftMutation = useMutation({
    mutationFn: async () => {
      if (!isUserShift) {
        throw new Error("You are not assigned to this shift");
      }

      let locationData: LocationData | null = null;
      
      try {
        locationData = await getCurrentLocation();
      } catch (error) {
        console.warn("Could not get location:", error);
        // Continue without location if geolocation fails
      }

      const updateData = {
        startTime: new Date().toISOString(),
        isActive: true,
        ...(locationData && {
          latitude: locationData.latitude.toString(),
          longitude: locationData.longitude.toString(),
          location: locationData.address,
        }),
      };

      const response = await apiRequest("PUT", `/api/shifts/${shift.id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Shift Started",
        description: "Your shift has been started successfully",
      });
      // Invalidate immediately
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet/history"] });
      
      // Also invalidate with a slight delay to ensure backend processing is complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
        queryClient.refetchQueries({ queryKey: ["/api/timesheet/current"] });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Shift",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // End shift mutation
  const endShiftMutation = useMutation({
    mutationFn: async () => {
      if (!isUserShift) {
        throw new Error("You are not assigned to this shift");
      }

      let locationData: LocationData | null = null;
      
      try {
        locationData = await getCurrentLocation();
      } catch (error) {
        console.warn("Could not get location:", error);
        // Continue without location if geolocation fails
      }

      const updateData = {
        endTime: new Date().toISOString(),
        isActive: false,
        ...(locationData && {
          latitude: locationData.latitude.toString(),
          longitude: locationData.longitude.toString(),
          location: locationData.address,
        }),
      };

      const response = await apiRequest("PUT", `/api/shifts/${shift.id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Shift Ended",
        description: "Your shift has been completed successfully",
      });
      // Invalidate immediately
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet/history"] });
      
      // Also invalidate with a slight delay to ensure backend processing is complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
        queryClient.refetchQueries({ queryKey: ["/api/timesheet/current"] });
        // Clear all timesheet-related cache
        queryClient.removeQueries({ queryKey: ["/api/timesheet"] });
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to End Shift",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartShift = () => {
    startShiftMutation.mutate();
  };

  const handleEndShift = () => {
    if (confirm("Are you sure you want to end this shift?")) {
      endShiftMutation.mutate();
    }
  };

  // Don't show buttons if user is not assigned to this shift
  if (!isUserShift) {
    return null;
  }

  const minutesUntilStart = getTimeUntilStartAllowed();

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-2">
        {canStartShift && (
          <Button
            onClick={handleStartShift}
            disabled={startShiftMutation.isPending || isGettingLocation}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {startShiftMutation.isPending || isGettingLocation ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isGettingLocation ? "Getting Location..." : "Starting..."}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Shift
              </>
            )}
          </Button>
        )}

        {!shift.isActive && shift.userId && isUserShift && !canStartBasedOnTime() && minutesUntilStart && (
          <Button
            disabled
            size="sm"
            variant="outline"
            className="opacity-50"
          >
            <Play className="mr-2 h-4 w-4" />
            Available in {minutesUntilStart}min
          </Button>
        )}

        {canEndShift && (
          <Button
            onClick={handleEndShift}
            disabled={endShiftMutation.isPending || isGettingLocation}
            variant="destructive"
            size="sm"
          >
            {endShiftMutation.isPending || isGettingLocation ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isGettingLocation ? "Getting Location..." : "Ending..."}
              </>
            ) : (
              <>
                <Square className="mr-2 h-4 w-4" />
                End Shift
              </>
            )}
          </Button>
        )}

        {shift.location && (
          <Button variant="outline" size="sm" disabled>
            <MapPin className="mr-2 h-4 w-4" />
            Located
          </Button>
        )}
      </div>
      
      {/* Timing feedback */}
      {!shift.isActive && shift.userId && isUserShift && !canStartBasedOnTime() && minutesUntilStart && (
        <div className="text-xs text-gray-500 mt-1">
          Shifts can only be started 5 minutes before scheduled time
        </div>
      )}
    </div>
  );
}