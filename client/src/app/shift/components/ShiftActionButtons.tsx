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
  const canStartShift = !shift.isActive && shift.userId;
  const canEndShift = shift.isActive && isUserShift;

  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }

      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsGettingLocation(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
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
          location: `${locationData.latitude}, ${locationData.longitude}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
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
          location: `${locationData.latitude}, ${locationData.longitude}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
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

  return (
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
  );
}