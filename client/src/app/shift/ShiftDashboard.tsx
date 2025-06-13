import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MyShiftsTab from "./components/MyShiftsTab";
import ShiftRequestsTab from "./components/ShiftRequestsTab";
import AllShiftsTab from "./components/AllShiftsTab";
import RequestShiftModal from "./components/RequestShiftModal";

export default function ShiftDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("my-shifts");
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const isAdminOrCoordinator = user?.role === "Admin" || user?.role === "Coordinator";
  const isAdmin = user?.role === "Admin";

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shift Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your shifts and track work assignments
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="grid grid-cols-3 lg:w-[400px]">
                  <TabsTrigger value="my-shifts" className="flex items-center gap-2">
                    🗂 My Shifts
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
                
                {activeTab === "my-shifts" && (
                  <Button 
                    onClick={() => setIsRequestModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Request Shift
                  </Button>
                )}
              </div>

              <div className="mt-6">
                <TabsContent value="my-shifts" className="space-y-4">
                  <MyShiftsTab />
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

      <RequestShiftModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />
    </div>
  );
}