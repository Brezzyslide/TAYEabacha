import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface OverviewTabProps {
  clientId?: string;
  companyId?: string;
}

export default function OverviewTab({ clientId, companyId }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client Overview</h3>
          <p className="text-gray-600">
            Overview content will be populated with live client data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}