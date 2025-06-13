import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, TriangleAlert } from "lucide-react";
import { type Shift } from "@shared/schema";
import { useLocation } from "wouter";

export default function CurrentShifts() {
  const [, navigate] = useLocation();
  const { data: shifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const activeShifts = shifts?.filter(shift => shift.isActive) || [];

  const getShiftDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const duration = now.getTime() - start.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getUserInitials = (userId: number) => {
    // This would normally come from a user lookup, but for now we'll generate initials
    const names = ["Mike Johnson", "Emma Davis", "Alex Smith"];
    const name = names[userId % names.length] || "Unknown User";
    return name.split(' ').map(n => n[0]).join('');
  };

  const getUserName = (userId: number) => {
    const names = ["Mike Johnson", "Emma Davis", "Alex Smith"];
    return names[userId % names.length] || "Unknown User";
  };

  const getLocationStatus = (shift: Shift) => {
    if (shift.latitude && shift.longitude) {
      return {
        icon: MapPin,
        text: "On-site",
        color: "text-green-600"
      };
    } else {
      return {
        icon: TriangleAlert,
        text: "Location pending",
        color: "text-orange-600"
      };
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <h3 className="text-lg font-semibold text-gray-900">Current Shifts</h3>
            <Badge variant="default" className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activeShifts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No active shifts.</p>
            <p className="text-sm">Staff shifts will appear here when started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeShifts.slice(0, 3).map((shift) => {
              const locationStatus = getLocationStatus(shift);
              return (
                <div key={shift.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-gray-700">
                        {getUserInitials(shift.userId)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{getUserName(shift.userId)}</p>
                      <p className="text-sm text-gray-500">
                        {shift.building && `${shift.building} • `}
                        {shift.floor && `Floor ${shift.floor}`}
                        {!shift.building && !shift.floor && "Location not specified"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {getShiftDuration(shift.startTime)}
                    </p>
                    <p className={`text-xs flex items-center ${locationStatus.color}`}>
                      <locationStatus.icon className="h-3 w-3 mr-1" />
                      {locationStatus.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <Button 
          className="w-full mt-4" 
          onClick={() => navigate("/shifts")}
        >
          View All Shifts
        </Button>
      </CardContent>
    </Card>
  );
}
