import { useState } from "react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MyShiftsTab from "./components/MyShiftsTab";
import ShiftCalendarTab from "./components/ShiftCalendarTab";
import RequestedShiftsTab from "./components/RequestedShiftsTab";
import ShiftRequestsTab from "./components/ShiftRequestsTab";
import AllShiftsTab from "./components/AllShiftsTab";

export default function ShiftDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("my-shifts");

  const isAdminOrCoordinator = user?.role === "Admin" || user?.role === "Coordinator";
  const isAdmin = user?.role === "Admin";

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">Shift Management</span>
            </div>

            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shift Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your shifts and track work assignments
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="grid grid-cols-5 lg:w-[600px]">
                  <TabsTrigger value="my-shifts" className="flex items-center gap-2">
                    🗂 My Shifts
                  </TabsTrigger>
                  <TabsTrigger value="shift-calendar" className="flex items-center gap-2">
                    📅 Calendar
                  </TabsTrigger>
                  <TabsTrigger value="requested-shifts" className="flex items-center gap-2">
                    📋 Requested
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
        </main>
      </div>
    </div>
  );
}