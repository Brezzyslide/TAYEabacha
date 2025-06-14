import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, Calendar } from "lucide-react";
import AvailabilityEditor from "./AvailabilityEditor";

export default function StaffAvailabilityPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Staff Availability</h1>
          </div>
          <p className="text-gray-600">
            Set your availability using the AM/PM/Active Night/Sleepover Night options for each day of the week
          </p>
        </div>

        {/* Main Content */}
        <AvailabilityEditor />

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>How It Works</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h4 className="font-medium text-blue-900 mb-2">Setting Availability</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Select days you're available to work</li>
                  <li>• Choose from AM, PM, Active Night, or Sleepover Night shifts</li>
                  <li>• Multiple shift types can be selected per day</li>
                  <li>• Save patterns for quick reuse</li>
                </ul>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <h4 className="font-medium text-green-900 mb-2">After Submission</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Your availability is sent to management for review</li>
                  <li>• Appears in your current availability status</li>
                  <li>• Saved patterns available for future use</li>
                  <li>• Management may make adjustments if needed</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded p-4">
              <h4 className="font-medium text-purple-900 mb-2">Shift Types</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="font-medium text-purple-800">AM:</span>
                  <p className="text-purple-700">Morning shifts</p>
                </div>
                <div>
                  <span className="font-medium text-purple-800">PM:</span>
                  <p className="text-purple-700">Afternoon/Evening shifts</p>
                </div>
                <div>
                  <span className="font-medium text-purple-800">Active Night:</span>
                  <p className="text-purple-700">Overnight active care</p>
                </div>
                <div>
                  <span className="font-medium text-purple-800">Sleepover Night:</span>
                  <p className="text-purple-700">Overnight sleepover support</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}