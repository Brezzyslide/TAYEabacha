import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pill, Clock, CheckCircle, AlertTriangle, Calendar, User } from "lucide-react";
import { format } from "date-fns";

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
  startDate: string;
  endDate?: string;
  instructions: string;
  status: string;
  isActive?: boolean;
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

  // Fetch medication plans filtered by company
  const { data: allMedicationPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["/api/medication-plans"],
    queryFn: () => fetch(`/api/medication-plans`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch medication plans');
      return res.json();
    }),
  });

  // Fetch medication records
  const { data: allMedicationRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/medication-records"],
    queryFn: () => fetch(`/api/medication-records`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch medication records');
      return res.json();
    }),
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

  // Filter data for this specific client and company
  const medicationPlans = allMedicationPlans.filter((plan: MedicationPlan) => 
    plan.clientId === parseInt(clientId) && 
    (plan.companyId === companyId || !plan.companyId) // Handle cases where companyId might not be set
  );

  const medicationRecords = allMedicationRecords.filter((record: MedicationRecord) => {
    const plan = allMedicationPlans.find((p: MedicationPlan) => p.id === record.planId);
    return plan && plan.clientId === parseInt(clientId) && 
           (plan.companyId === companyId || !plan.companyId);
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

  return (
    <div className="space-y-6">
      {/* Header with client info */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medication Management</h1>
          {client && (
            <p className="text-gray-600 mt-1">
              {client.firstName} {client.lastName} ({client.clientId})
            </p>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Active Plans</p>
                <p className="text-2xl font-bold">{medicationPlans.filter((p: MedicationPlan) => p.status === 'active').length}</p>
              </div>
              <Pill className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Administered Today</p>
                <p className="text-2xl font-bold">
                  {medicationRecords.filter((r: MedicationRecord) => 
                    r.result === 'administered' && 
                    r.administeredTime &&
                    format(new Date(r.administeredTime), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Missed Today</p>
                <p className="text-2xl font-bold">
                  {medicationRecords.filter((r: MedicationRecord) => 
                    r.result === 'missed' && 
                    format(new Date(r.scheduledTime), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold">
                  {medicationRecords.filter((r: MedicationRecord) => r.result === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Medication Plans</TabsTrigger>
          <TabsTrigger value="records">Administration Records</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {filteredPlans.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Medication Plans</h3>
                <p className="text-gray-600">This client doesn't have any medication plans matching your criteria.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredPlans.map((plan: MedicationPlan) => (
                <Card key={plan.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Pill className="h-5 w-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium">{plan.medicationName}</h4>
                          <p className="text-sm text-gray-600">{plan.dosage} - {plan.frequency}</p>
                          <p className="text-sm text-gray-500">Route: {plan.route}</p>
                          {plan.instructions && (
                            <p className="text-sm text-gray-500 mt-1">Instructions: {plan.instructions}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Start: {format(new Date(plan.startDate), 'MMM dd, yyyy')}
                            {plan.endDate && ` - End: ${format(new Date(plan.endDate), 'MMM dd, yyyy')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                          {plan.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          {medicationRecords.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Administration Records</h3>
                <p className="text-gray-600">No medication administration records found for this client.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {medicationRecords.map((record: MedicationRecord) => (
                <Card key={record.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Pill className="h-4 w-4 text-blue-500" />
                          <h4 className="font-medium">{record.medicationName || 'Unknown Medication'}</h4>
                          <Badge variant={
                            record.result === 'administered' ? 'default' :
                            record.result === 'refused' ? 'destructive' :
                            record.result === 'missed' ? 'secondary' :
                            'outline'
                          }>
                            {record.result}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>Scheduled: {format(new Date(record.scheduledTime), 'PPp')}</p>
                          {record.administeredTime && (
                            <p>Administered: {format(new Date(record.administeredTime), 'PPp')}</p>
                          )}
                          <p className="text-green-600 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Administered by: {record.administratorName || 'Unknown'}
                          </p>
                          {record.notes && (
                            <p className="text-gray-700">Notes: {record.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}