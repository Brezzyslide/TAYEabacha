import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, Pill, Clock, CheckCircle, AlertTriangle, Calendar, Camera } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import UniversalHeader from "@/components/layout/universal-header";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import RecordAdministrationModal from "./components/RecordAdministrationModal";
import AddMedicationPlanModal from "./components/AddMedicationPlanModal";

interface MedicationPlan {
  id: number;
  clientId: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  route?: string;
  startDate: string;
  endDate?: string;
  instructions: string;
  isActive: boolean;
  createdAt: string;
}

interface MedicationRecord {
  id: number;
  planId: number;
  scheduledTime: string;
  administeredTime?: string;
  result: string;
  notes?: string;
  administeredBy: number;
  createdAt: string;
}

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  clientId: string;
}

export default function MedicationDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("plans");
  const [recordAdminModal, setRecordAdminModal] = useState<{
    isOpen: boolean;
    clientId?: number;
    clientName?: string;
  }>({
    isOpen: false,
  });
  const [addPlanModal, setAddPlanModal] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch medication plans
  const { data: medicationPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["/api/medication-plans"],
    queryFn: async () => {
      const res = await fetch("/api/medication-plans", {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch medication plans');
      return res.json();
    },
  });

  // Fetch medication records
  const { data: medicationRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/medication-records"],
    queryFn: async () => {
      const res = await fetch("/api/medication-records", {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch medication records');
      return res.json();
    },
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    },
  });

  const getClientName = (clientId: number) => {
    const client = clients.find((c: Client) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'Given': 'bg-green-100 text-green-800',
      'Missed': 'bg-red-100 text-red-800',
      'Refused': 'bg-yellow-100 text-yellow-800',
      'Pending': 'bg-blue-100 text-blue-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  if (plansLoading || recordsLoading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <UniversalHeader />
          <main className="flex-1 p-6">
            <div className="text-center py-12">Loading medication data...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <UniversalHeader />
        
        <main className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Pill className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Medication Tracker</h1>
                <p className="text-gray-600">Manage medication plans and administration records</p>
              </div>
            </div>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setAddPlanModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Medication Plan
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Pill className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Active Plans</p>
                    <p className="text-2xl font-bold">{medicationPlans.filter((p: MedicationPlan) => p.isActive).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Given Today</p>
                    <p className="text-2xl font-bold">
                      {medicationRecords.filter((r: MedicationRecord) => 
                        r.result === 'Given' && 
                        format(new Date(r.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      ).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Missed Today</p>
                    <p className="text-2xl font-bold">
                      {medicationRecords.filter((r: MedicationRecord) => 
                        r.result === 'Missed' && 
                        format(new Date(r.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      ).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold">
                      {medicationRecords.filter((r: MedicationRecord) => r.result === 'Pending').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search medications or clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client: Client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.firstName} {client.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="plans">Medication Plans</TabsTrigger>
              <TabsTrigger value="records">Administration Records</TabsTrigger>
              <TabsTrigger value="schedule">Record Administration</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Medication Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  {medicationPlans.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Pill className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No medication plans found</p>
                      <p className="text-sm">Create a new medication plan to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicationPlans.map((plan: MedicationPlan) => (
                        <div key={plan.id} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-semibold">{plan.medicationName}</h3>
                                <Badge className={plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                  {plan.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                Client: {getClientName(plan.clientId)}
                              </p>
                              <p className="text-sm text-gray-600 mb-1">
                                Dosage: {plan.dosage} | Frequency: {plan.frequency}
                              </p>
                              <p className="text-sm text-gray-600">
                                Start: {format(new Date(plan.startDate), 'MMM dd, yyyy')}
                                {plan.endDate && ` | End: ${format(new Date(plan.endDate), 'MMM dd, yyyy')}`}
                              </p>
                              {plan.instructions && (
                                <p className="text-sm text-gray-500 mt-2">{plan.instructions}</p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setRecordAdminModal({
                                  isOpen: true,
                                  clientId: plan.clientId,
                                  clientName: getClientName(plan.clientId),
                                })}
                                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              >
                                <Camera className="h-3 w-3 mr-1" />
                                Record Administration
                              </Button>
                              <Button variant="outline" size="sm">
                                View Records
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="records" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Administration Records</CardTitle>
                </CardHeader>
                <CardContent>
                  {medicationRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No medication records found</p>
                      <p className="text-sm">Records will appear here after medication administration</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicationRecords.slice(0, 10).map((record: MedicationRecord) => (
                        <div key={record.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge className={getStatusBadge(record.result)}>
                                  {record.result}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {format(new Date(record.scheduledTime), 'MMM dd, yyyy HH:mm')}
                                </span>
                              </div>
                              {record.administeredTime && (
                                <p className="text-sm text-gray-600 mb-1">
                                  Administered: {format(new Date(record.administeredTime), 'MMM dd, yyyy HH:mm')}
                                </p>
                              )}
                              {record.notes && (
                                <p className="text-sm text-gray-500">{record.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Camera className="h-5 w-5" />
                    <span>Active Plans - Record Administration</span>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    Select a medication plan below to record administration with photo documentation
                  </p>
                </CardHeader>
                <CardContent>
                  {medicationPlans.filter((plan: MedicationPlan) => plan.isActive).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Pill className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No active medication plans available</p>
                      <p className="text-sm">Create medication plans to enable administration recording</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicationPlans
                        .filter((plan: MedicationPlan) => plan.isActive)
                        .map((plan: MedicationPlan) => (
                          <div key={plan.id} className="border rounded-lg p-4 hover:bg-blue-50 transition-colors">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <h3 className="font-semibold text-lg">{plan.medicationName}</h3>
                                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                                  <div>
                                    <span className="font-medium">Client:</span> {getClientName(plan.clientId)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Dosage:</span> {plan.dosage}
                                  </div>
                                  <div>
                                    <span className="font-medium">Frequency:</span> {plan.frequency}
                                  </div>
                                  <div>
                                    <span className="font-medium">Route:</span> {plan.route || 'Not specified'}
                                  </div>
                                </div>
                                {plan.instructions && (
                                  <div className="text-sm text-gray-500 mb-3">
                                    <span className="font-medium">Instructions:</span> {plan.instructions}
                                  </div>
                                )}
                              </div>
                              <div className="ml-6">
                                <Button
                                  onClick={() => setRecordAdminModal({
                                    isOpen: true,
                                    clientId: plan.clientId,
                                    clientName: getClientName(plan.clientId),
                                  })}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
                                  size="lg"
                                >
                                  <Camera className="h-4 w-4 mr-2" />
                                  Record Administration
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Record Administration Modal */}
      {recordAdminModal.isOpen && recordAdminModal.clientId && recordAdminModal.clientName && (
        <RecordAdministrationModal
          isOpen={recordAdminModal.isOpen}
          onClose={() => setRecordAdminModal({ isOpen: false })}
          clientId={recordAdminModal.clientId}
          clientName={recordAdminModal.clientName}
        />
      )}

      {/* Add Medication Plan Modal */}
      <AddMedicationPlanModal
        isOpen={addPlanModal}
        onClose={() => setAddPlanModal(false)}
      />
    </div>
  );
}