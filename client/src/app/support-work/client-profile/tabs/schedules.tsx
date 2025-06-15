import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

interface SchedulesTabProps {
  clientId: string;
  companyId: string;
}

export default function SchedulesTab({ clientId, companyId }: SchedulesTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Schedules</h3>
          <p className="text-gray-600">
            Shift schedules for this client will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}