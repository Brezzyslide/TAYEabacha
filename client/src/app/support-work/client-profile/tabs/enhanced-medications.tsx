import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "lucide-react";

interface EnhancedMedicationsTabProps {
  clientId: string;
  companyId: string;
}

export default function EnhancedMedicationsTab({ clientId, companyId }: EnhancedMedicationsTabProps) {
  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Enhanced Medications</h3>
          <p className="text-gray-600">No enhanced medication data found for this client.</p>
        </CardContent>
      </Card>
    </div>
  );
}