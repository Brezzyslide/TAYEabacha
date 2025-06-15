import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pill, Clock, CheckCircle, AlertTriangle, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import RecordAdministrationModal from "@/app/medications/components/RecordAdministrationModal";

interface MedicationsTabProps {
  clientId: string;
  companyId: string;
}

interface MedicationPlan {
  id: number;
  clientId: number;
  companyId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  route?: string;
  timeOfDay?: string;
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  instructions: string;
  sideEffects: string[];
  status: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MedicationRecord {
  id: number;
  planId: number;
  scheduledTime: string;
  administeredTime?: string;
  result: string;
  notes?: string;
  administeredBy: number;
  administratorName?: string;
  medicationName?: string;
  createdAt: string;
}

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  clientId: string;
  companyId: string;
}

export default function MedicationsTab({ clientId, companyId }: MedicationsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [recordAdminModal, setRecordAdminModal] = useState<{
    isOpen: boolean;
    medicationPlan?: MedicationPlan;
  }>({
    isOpen: false,
  });

  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  // Fetch medication plans for this specific client
  const { data: medicationPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["/api/clients", clientId, "medication-plans"],
    queryFn: () => fetch(`/api/clients/${clientId}/medication-plans`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch medication plans');
      return res.json();
    }),
    enabled: !!clientId,
  });

  // Fetch medication records for this specific client
  const { data: medicationRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/clients", clientId, "medication-records"],
    queryFn: () => fetch(`/api/clients/${clientId}/medication-records`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch medication records');
      return res.json();
    }),
    enabled: !!clientId,
  });

  // Fetch client data for context
  const { data: client } = useQuery({
    queryKey: ["/api/clients", clientId],
    queryFn: () => fetch(`/api/clients/${clientId}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch client');
      return res.json();
    }),
    enabled: !!clientId,
  });

  // Filter medication plans based on search and status
  const filteredPlans = medicationPlans.filter((plan: MedicationPlan) => {
    const matchesSearch = plan.medicationName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isLoading = plansLoading || recordsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading medications...</p>
        </CardContent>
      </Card>
    );
  }

  const activePlans = medicationPlans.filter((p: MedicationPlan) => p.status === 'active');
  const todayRecords = medicationRecords.filter((r: MedicationRecord) => {
    const today = new Date().toISOString().split('T')[0];
    const recordDate = new Date(r.scheduledTime).toISOString().split('T')[0];
    return recordDate === today;
  });
  const administeredToday = todayRecords.filter((r: MedicationRecord) => r.result === 'administered');
  const pendingToday = todayRecords.filter((r: MedicationRecord) => r.result === 'pending');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Pill className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{activePlans.length}</p>
                    <p className="text-gray-600">Active Plans</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{administeredToday.length}</p>
                    <p className="text-gray-600">Given Today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{pendingToday.length}</p>
                    <p className="text-gray-600">Pending Today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{medicationRecords.length}</p>
                    <p className="text-gray-600">Total Records</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Plans Quick View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Active Medication Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activePlans.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No active medication plans</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activePlans.slice(0, 5).map((plan: MedicationPlan) => (
                    <div key={plan.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{plan.medicationName}</h4>
                        <p className="text-sm text-gray-600">{plan.dosage} - {plan.frequency}</p>
                        <p className="text-xs text-gray-500">Route: {plan.route}</p>
                        {plan.timeOfDay && (
                          <p className="text-xs text-gray-500">Time: {plan.timeOfDay}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setRecordAdminModal({ isOpen: true, medicationPlan: plan })}
                      >
                        Record
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search medications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Medication Plans */}
          <div className="space-y-4">
            {filteredPlans.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Medication Plans</h3>
                  <p className="text-gray-600">No medication plans match your search criteria.</p>
                </CardContent>
              </Card>
            ) : (
              filteredPlans.map((plan: MedicationPlan) => (
                <Card key={plan.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{plan.medicationName}</h3>
                          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                            {plan.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>Dosage:</strong> {plan.dosage}</p>
                            <p><strong>Frequency:</strong> {plan.frequency}</p>
                            <p><strong>Route:</strong> {plan.route}</p>
                            {plan.timeOfDay && (
                              <p><strong>Time of Day:</strong> {plan.timeOfDay}</p>
                            )}
                          </div>
                          <div>
                            <p><strong>Prescribed by:</strong> {plan.prescribedBy}</p>
                            <p><strong>Start Date:</strong> {format(new Date(plan.startDate), 'MMM dd, yyyy')}</p>
                            {plan.endDate && (
                              <p><strong>End Date:</strong> {format(new Date(plan.endDate), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        </div>
                        {plan.instructions && (
                          <div className="mt-3">
                            <p className="text-sm"><strong>Instructions:</strong> {plan.instructions}</p>
                          </div>
                        )}
                        {plan.sideEffects && plan.sideEffects.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm"><strong>Side Effects:</strong> {plan.sideEffects.join(', ')}</p>
                          </div>
                        )}
                      </div>
                      {plan.status === 'active' && (
                        <Button
                          onClick={() => setRecordAdminModal({ isOpen: true, medicationPlan: plan })}
                          className="ml-4"
                        >
                          Record Administration
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Medication Records</CardTitle>
            </CardHeader>
            <CardContent>
              {medicationRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No medication records found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {medicationRecords.map((record: MedicationRecord) => (
                    <div key={record.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium">{record.medicationName}</h4>
                          <p className="text-sm text-gray-600">
                            Scheduled: {format(new Date(record.scheduledTime), 'MMM dd, yyyy HH:mm')}
                          </p>
                          {record.administeredTime && (
                            <p className="text-sm text-gray-600">
                              Administered: {format(new Date(record.administeredTime), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                          {record.administratorName && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                              <User className="h-3 w-3" />
                              <span>Administered by: {record.administratorName}</span>
                            </div>
                          )}
                          {record.notes && (
                            <p className="text-sm text-gray-600 mt-2">
                              <strong>Notes:</strong> {record.notes}
                            </p>
                          )}
                        </div>
                        <Badge variant={
                          record.result === 'administered' ? 'default' :
                          record.result === 'refused' ? 'destructive' :
                          record.result === 'missed' ? 'secondary' : 'outline'
                        }>
                          {record.result}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Administration Modal */}
      <RecordAdministrationModal
        isOpen={recordAdminModal.isOpen}
        onClose={() => setRecordAdminModal({ isOpen: false })}
        medicationPlan={recordAdminModal.medicationPlan}
        clientId={parseInt(clientId)}
        clientName={client ? `${client.firstName} ${client.lastName}` : undefined}
      />
    </div>
  );
}