import { Card, CardContent } from "@/components/ui/card";
import { Target, AlertTriangle } from "lucide-react";

interface CarePlansTabProps {
  clientId: string;
  companyId: string;
}

export default function CarePlansTab({ clientId, companyId }: CarePlansTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Target className="h-12 w-12 text-gray-400" />
              <AlertTriangle className="h-5 w-5 text-yellow-500 absolute -top-1 -right-1" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Care Plans Module</h3>
          <p className="text-gray-600 mb-4">
            Care Plans module is not yet implemented. This feature will include:
          </p>
          <div className="text-left max-w-md mx-auto space-y-2 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>Individual care plan creation and management</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>Goal tracking and progress monitoring</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>Care plan templates and customization</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>Multi-disciplinary team collaboration</span>
            </div>
          </div>
          <div className="mt-6 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              This module requires dedicated development to integrate with client profiles and care workflows.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}