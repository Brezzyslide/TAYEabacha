import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface ConflictDetectionBannerProps {
  conflicts: any[];
}

export default function ConflictDetectionBanner({ conflicts }: ConflictDetectionBannerProps) {
  if (conflicts.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900">Availability Conflicts Detected</h3>
            <p className="text-sm text-orange-700 mb-3">
              You have {conflicts.length} shift{conflicts.length > 1 ? 's' : ''} that conflict with your current availability.
            </p>
            <div className="space-y-2">
              {conflicts.slice(0, 3).map((shift: any) => (
                <div key={shift.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center space-x-3">
                    <Badge variant="destructive" className="text-xs">Conflict</Badge>
                    <div>
                      <div className="font-medium text-sm">{shift.title || "Untitled Shift"}</div>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(shift.startTime), "MMM dd, yyyy")}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(shift.startTime), "HH:mm")} - 
                            {shift.endTime ? format(new Date(shift.endTime), "HH:mm") : "Ongoing"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {conflicts.length > 3 && (
                <div className="text-sm text-orange-700">
                  ... and {conflicts.length - 3} more conflicts
                </div>
              )}
            </div>
            <div className="mt-3 flex space-x-2">
              <Button size="sm" variant="outline">
                Update Availability
              </Button>
              <Button size="sm" variant="outline">
                Contact Manager
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}