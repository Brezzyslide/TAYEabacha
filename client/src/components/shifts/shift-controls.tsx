import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, MapPin } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

interface ShiftControlsProps {
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  onStartShift: () => void;
  startShiftMutation: UseMutationResult<any, Error, any>;
  building: string;
  setBuilding: (value: string) => void;
  floor: string;
  setFloor: (value: string) => void;
}

export default function ShiftControls({
  location,
  onStartShift,
  startShiftMutation,
  building,
  setBuilding,
  floor,
  setFloor
}: ShiftControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Play className="h-5 w-5" />
          <span>Start New Shift</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="building">Building</Label>
            <Input
              id="building"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="e.g., Building A"
            />
          </div>
          <div>
            <Label htmlFor="floor">Floor</Label>
            <Input
              id="floor"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="e.g., Floor 2"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            onClick={onStartShift}
            disabled={!location || startShiftMutation.isPending}
            className="flex-1"
          >
            {startShiftMutation.isPending ? (
              <>
                <Play className="h-4 w-4 mr-2 animate-spin" />
                Starting Shift...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Shift
              </>
            )}
          </Button>
          
          {!location && (
            <div className="flex items-center space-x-2 text-orange-600 text-sm">
              <MapPin className="h-4 w-4" />
              <span>Location required</span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-gray-500">
          Starting a shift will record your current location and time. Make sure location services are enabled.
        </p>
      </CardContent>
    </Card>
  );
}
