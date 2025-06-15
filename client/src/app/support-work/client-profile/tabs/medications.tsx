import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "lucide-react";

interface MedicationsTabProps {
  clientId: string;
  companyId: string;
}

export default function MedicationsTab({ clientId, companyId }: MedicationsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Medications</h3>
          <p className="text-gray-600">
            Medication plans and administration records for this client will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}