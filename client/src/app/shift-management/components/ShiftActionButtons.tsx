import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Shift } from "@shared/schema";
import { Play, Square, MapPin, Clock, Loader2 } from "lucide-react";

interface ShiftActionButtonsProps {
  shift: Shift;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function ShiftActionButtons({ shift }: ShiftActionButtonsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Check if current user is assigned to this shift
  const isAssignedToUser = shift.userId === user?.id;
  const isUserShift = isAssignedToUser && user?.tenantId === shift.tenantId;

  // Get current shift status based on data
  const getShiftStatus = () => {
    if (!shift.userId) return "unassigned";
    if (shift.endTime) return "completed";
    if (shift.startTime && shift.isActive) return "in-progress";
    return "assigned";
  };

  const shiftStatus = getShiftStatus();

  // Get user's current location
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

      const response = await apiRequest("POST", `/api/shifts/${shift.id}/end`, {
        ...(locationData && {
          latitude: locationData.latitude.toString(),
          longitude: locationData.longitude.toString(),
          location: `${locationData.latitude}, ${locationData.longitude}`,
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Shift Completed",
        description: "Your shift has been completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Complete Shift",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Status badge component
  const StatusBadge = () => {
    const statusConfig = {
      unassigned: { variant: "secondary" as const, label: "Unassigned", icon: null },
      assigned: { variant: "outline" as const, label: "Assigned", icon: <Clock className="w-3 h-3" /> },
      "in-progress": { variant: "default" as const, label: "In Progress", icon: <Play className="w-3 h-3" /> },
      completed: { variant: "destructive" as const, label: "Completed", icon: <Square className="w-3 h-3" /> },
    };

    const config = statusConfig[shiftStatus as keyof typeof statusConfig];
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // Don't show action buttons if user is not assigned to this shift
  if (!isUserShift) {
    return <StatusBadge />;
  }

  return (
    <div className="flex items-center gap-2">
      <StatusBadge />
      
      {shiftStatus === "assigned" && (
        <Button
          size="sm"
          onClick={() => startShiftMutation.mutate()}
          disabled={startShiftMutation.isPending || isGettingLocation}
          className="bg-green-600 hover:bg-green-700"
        >
          {(startShiftMutation.isPending || isGettingLocation) ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isGettingLocation ? "Getting Location..." : "Starting..."}
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Shift
            </>
          )}
        </Button>
      )}

      {shiftStatus === "in-progress" && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => endShiftMutation.mutate()}
          disabled={endShiftMutation.isPending || isGettingLocation}
        >
          {(endShiftMutation.isPending || isGettingLocation) ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isGettingLocation ? "Getting Location..." : "Ending..."}
            </>
          ) : (
            <>
              <Square className="w-4 h-4 mr-2" />
              End Shift
            </>
          )}
        </Button>
      )}

      {isGettingLocation && (
        <div className="flex items-center text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 mr-1" />
          Getting location...
        </div>
      )}
    </div>
  );
}