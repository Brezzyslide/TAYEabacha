import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "lucide-react";

interface EnhancedMedicationsTabProps {
  clientId: string;
  companyId: string;
}

export default function EnhancedMedicationsTab({ clientId, companyId }: EnhancedMedicationsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Enhanced Medications</h3>
          <p className="text-gray-600">
            Enhanced medication management features for this client will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}