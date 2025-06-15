import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, MapPin } from "lucide-react";

interface SchedulesTabProps {
  clientId: string;
  companyId: string;
}

export default function SchedulesTab({ clientId, companyId }: SchedulesTabProps) {
  // Fetch shifts for this client
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["/api/shifts", { clientId }],
    queryFn: () => fetch(`/api/shifts?clientId=${clientId}`).then(res => res.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedules...</p>
        </CardContent>
      </Card>
    );
  }

  if (shifts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No shifts scheduled</h3>
          <p className="text-gray-600">
            No shifts scheduled for this client yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium mb-4">Upcoming & Recent Shifts ({shifts.length})</h3>
          <div className="space-y-4">
            {shifts.map((shift: any) => (
              <div key={shift.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {new Date(shift.startTime).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {new Date(shift.startTime).toLocaleTimeString()} - {new Date(shift.endTime).toLocaleTimeString()}
                      </span>
                    </div>
                    {shift.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{shift.location}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      shift.status === 'completed' ? 'bg-green-100 text-green-800' :
                      shift.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                      shift.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {shift.status}
                    </span>
                    {shift.assignedStaffId && (
                      <span className="text-xs text-gray-500">
                        Staff ID: {shift.assignedStaffId}
                      </span>
                    )}
                  </div>
                </div>
                
                {shift.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Notes: </span>
                      {shift.notes}
                    </p>
                  </div>
                )}

                {(shift.checkinTime || shift.checkoutTime) && (
                  <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                    {shift.checkinTime && (
                      <div>Check-in: {new Date(shift.checkinTime).toLocaleString()}</div>
                    )}
                    {shift.checkoutTime && (
                      <div>Check-out: {new Date(shift.checkoutTime).toLocaleString()}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}