import { useState } from "react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import MyShiftsTab from "./components/MyShiftsTab";
import ShiftCalendarTab from "./components/ShiftCalendarTab";
import PendingRequestsTab from "./components/PendingRequestsTab";
import RequestedShiftsTab from "./components/RequestedShiftsTab";
import ShiftRequestsTab from "./components/ShiftRequestsTab";
import AllShiftsTab from "./components/AllShiftsTab";

export default function ShiftDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("shift-calendar");

  const isAdminOrCoordinator = user?.role === "Admin" || user?.role === "Coordinator";
  const isAdmin = user?.role === "Admin";

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shift Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your shifts and track work assignments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-6">
                <TabsList className="grid grid-cols-6 lg:w-[700px]">
                  <TabsTrigger value="shift-calendar" className="flex items-center gap-2">
                    📅 Calendar
                  </TabsTrigger>
                  <TabsTrigger value="my-shifts" className="flex items-center gap-2">
                    🗂 My Shifts
                  </TabsTrigger>
                  <TabsTrigger value="pending-requests" className="flex items-center gap-2">
                    🟡 Pending
                  </TabsTrigger>
                  <TabsTrigger value="requested-shifts" className="flex items-center gap-2">
                    📋 Available
                  </TabsTrigger>
                  {isAdminOrCoordinator && (
                    <TabsTrigger value="requests" className="flex items-center gap-2">
                      📝 Requests
                    </TabsTrigger>
                  )}
                  {isAdmin && (
                    <TabsTrigger value="all-shifts" className="flex items-center gap-2">
                      🏢 All Shifts
                    </TabsTrigger>
                  )}
                </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="my-shifts" className="space-y-4">
            <MyShiftsTab />
          </TabsContent>

          <TabsContent value="shift-calendar" className="space-y-4">
            <ShiftCalendarTab />
          </TabsContent>

          <TabsContent value="pending-requests" className="space-y-4">
            <PendingRequestsTab />
          </TabsContent>

          <TabsContent value="requested-shifts" className="space-y-4">
            <RequestedShiftsTab />
          </TabsContent>

          {isAdminOrCoordinator && (
            <TabsContent value="requests" className="space-y-4">
              <ShiftRequestsTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="all-shifts" className="space-y-4">
              <AllShiftsTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}