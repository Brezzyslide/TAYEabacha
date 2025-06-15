import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

interface CarePlansTabProps {
  clientId: string;
  companyId: string;
}

export default function CarePlansTab({ clientId, companyId }: CarePlansTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Care Plans</h3>
          <p className="text-gray-600">
            Care plans and goals for this client will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}