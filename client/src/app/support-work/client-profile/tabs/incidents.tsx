import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface IncidentsTabProps {
  clientId: string;
  companyId: string;
}

export default function IncidentsTab({ clientId, companyId }: IncidentsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Incident Reports</h3>
          <p className="text-gray-600">
            Incident reports for this client will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}