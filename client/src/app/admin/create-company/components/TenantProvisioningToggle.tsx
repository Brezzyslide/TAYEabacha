import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

interface TenantProvisioningToggleProps {
  includeDemoData: boolean;
  onToggle: (value: boolean) => void;
}

export default function TenantProvisioningToggle({ includeDemoData, onToggle }: TenantProvisioningToggleProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Info className="h-5 w-5 text-blue-600" />
          <span>Demo Data Options</span>
        </CardTitle>
        <CardDescription>
          Choose whether to include sample data for immediate platform testing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start space-x-3">
          <Checkbox
            id="includeDemoData"
            checked={includeDemoData}
            onCheckedChange={onToggle}
          />
          <div className="space-y-2">
            <label 
              htmlFor="includeDemoData" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include demo data for new tenant
            </label>
            <div className="text-sm text-gray-600">
              {includeDemoData ? (
                <div className="space-y-1">
                  <p className="text-green-700 font-medium">✓ Will include:</p>
                  <ul className="text-xs space-y-1 ml-4">
                    <li>• 3 sample clients with complete profiles</li>
                    <li>• 14 sample shifts across all shift types</li>
                    <li>• NDIS budgets with pricing configurations</li>
                    <li>• Sample care support plans</li>
                    <li>• Medication plans and hour allocations</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    Recommended for testing and demonstration purposes
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-orange-700 font-medium">⚠ Empty tenant:</p>
                  <p className="text-xs text-gray-600">
                    Tenant will be created without any sample data. You'll need to manually create clients, shifts, and other content to test platform features.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}