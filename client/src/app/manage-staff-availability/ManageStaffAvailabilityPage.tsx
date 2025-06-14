import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Settings, Calendar } from "lucide-react";
import AdminAvailabilityDashboard from "./AdminAvailabilityDashboard";

export default function ManageStaffAvailabilityPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Manage Staff Availability</h1>
          </div>
          <p className="text-gray-600">
            View, edit, and manage staff availability submissions with conflict detection and monthly calendar views
          </p>
        </div>

        {/* Main Content */}
        <AdminAvailabilityDashboard />
      </div>
    </div>
  );
}