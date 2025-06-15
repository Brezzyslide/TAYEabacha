import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface ObservationsTabProps {
  clientId: number;
  clientName: string;
}

export default function ObservationsTab({ clientId, clientName }: ObservationsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Hourly Observations</h3>
          <p className="text-gray-600">
            Hourly observation records for this client will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}