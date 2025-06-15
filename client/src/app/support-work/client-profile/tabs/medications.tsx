import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pill, Clock, CheckCircle, AlertTriangle, Calendar, User, BarChart3 } from "lucide-react";
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
    queryFn: () => fetch(`/api/clients/${clientId}/medication-records`, {
      credentials: 'include'
    }).then(res => {
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
  
  // Calculate compliance metrics for each medication plan
  const complianceMetrics = activePlans.map((plan: MedicationPlan) => {
    const planRecords = medicationRecords.filter((r: MedicationRecord) => (r as any).medicationPlanId === plan.id);
    const totalRecords = planRecords.length;
    const administeredCount = planRecords.filter((r: MedicationRecord) => r.result === 'administered').length;
    const refusedCount = planRecords.filter((r: MedicationRecord) => r.result === 'refused').length;
    const missedCount = planRecords.filter((r: MedicationRecord) => r.result === 'missed').length;
    const complianceRate = totalRecords > 0 ? Math.round((administeredCount / totalRecords) * 100) : 0;
    
    return {
      planId: plan.id,
      medicationName: plan.medicationName,
      totalRecords,
      administeredCount,
      refusedCount,
      missedCount,
      complianceRate
    };
  });

  // Overall compliance metrics
  const totalRecords = medicationRecords.length;
  const totalAdministered = medicationRecords.filter((r: MedicationRecord) => r.result === 'administered').length;
  const totalRefused = medicationRecords.filter((r: MedicationRecord) => r.result === 'refused').length;
  const totalMissed = medicationRecords.filter((r: MedicationRecord) => r.result === 'missed').length;
  const overallCompliance = totalRecords > 0 ? Math.round((totalAdministered / totalRecords) * 100) : 0;

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
                    <p className="text-2xl font-bold">{totalAdministered}</p>
                    <p className="text-gray-600">Administered</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{totalRefused}</p>
                    <p className="text-gray-600">Refused</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{overallCompliance}%</p>
                    <p className="text-gray-600">Compliance Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Medication Compliance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {complianceMetrics.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No compliance data available</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overall Summary Stats */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border">
                    <h3 className="text-lg font-semibold mb-4 text-center">Overall Medication Administration Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-3xl font-bold text-green-600">{totalAdministered}</p>
                        <p className="text-sm text-gray-600">Successful</p>
                        <p className="text-xs text-gray-500">{totalRecords > 0 ? Math.round((totalAdministered / totalRecords) * 100) : 0}%</p>
                      </div>
                      <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-3xl font-bold text-red-600">{totalRefused}</p>
                        <p className="text-sm text-gray-600">Refused</p>
                        <p className="text-xs text-gray-500">{totalRecords > 0 ? Math.round((totalRefused / totalRecords) * 100) : 0}%</p>
                      </div>
                      <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-3xl font-bold text-orange-600">{totalMissed}</p>
                        <p className="text-sm text-gray-600">Missed</p>
                        <p className="text-xs text-gray-500">{totalRecords > 0 ? Math.round((totalMissed / totalRecords) * 100) : 0}%</p>
                      </div>
                      <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-3xl font-bold text-blue-600">{totalRecords}</p>
                        <p className="text-sm text-gray-600">Total Records</p>
                        <p className="text-xs text-gray-500">All Time</p>
                      </div>
                    </div>
                    
                    {/* Overall Progress Bar */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Overall Compliance</span>
                        <span className="text-sm font-bold">{overallCompliance}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${overallCompliance >= 80 ? 'bg-green-500' : overallCompliance >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${overallCompliance}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {complianceMetrics.map((metric: any) => {
                      const successRate = metric.totalRecords > 0 ? Math.round((metric.administeredCount / metric.totalRecords) * 100) : 0;
                      const refusedRate = metric.totalRecords > 0 ? Math.round((metric.refusedCount / metric.totalRecords) * 100) : 0;
                      const missedRate = metric.totalRecords > 0 ? Math.round((metric.missedCount / metric.totalRecords) * 100) : 0;
                      
                      return (
                        <div key={metric.planId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-medium">{metric.medicationName}</span>
                            <Badge variant={successRate >= 80 ? 'default' : 'destructive'}>
                              {successRate}% Success
                            </Badge>
                          </div>
                          
                          {/* Visual Progress Bars */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-600 w-16">Success:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full bg-green-500"
                                  style={{ width: `${successRate}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-green-600 w-8">{successRate}%</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 w-16">Refused:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full bg-red-500"
                                  style={{ width: `${refusedRate}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-red-600 w-8">{refusedRate}%</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-orange-600 w-16">Missed:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full bg-orange-500"
                                  style={{ width: `${missedRate}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-orange-600 w-8">{missedRate}%</span>
                            </div>
                          </div>
                          
                          {/* Detailed Numbers */}
                          <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="bg-green-50 rounded p-2">
                              <p className="font-bold text-green-600">{metric.administeredCount}</p>
                              <p className="text-green-600">Successful</p>
                            </div>
                            <div className="bg-red-50 rounded p-2">
                              <p className="font-bold text-red-600">{metric.refusedCount}</p>
                              <p className="text-red-600">Refused</p>
                            </div>
                            <div className="bg-orange-50 rounded p-2">
                              <p className="font-bold text-orange-600">{metric.missedCount}</p>
                              <p className="text-orange-600">Missed</p>
                            </div>
                            <div className="bg-blue-50 rounded p-2">
                              <p className="font-bold text-blue-600">{metric.totalRecords}</p>
                              <p className="text-blue-600">Total</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                  {activePlans.slice(0, 5).map((plan: MedicationPlan) => {
                    const planCompliance = complianceMetrics.find((m: any) => m.planId === plan.id);
                    return (
                      <div key={plan.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{plan.medicationName}</h4>
                            <Badge variant={planCompliance && planCompliance.complianceRate >= 80 ? 'default' : 'destructive'}>
                              {planCompliance ? `${planCompliance.complianceRate}%` : '0%'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{plan.dosage} - {plan.frequency}</p>
                          {planCompliance && (
                            <div className="flex gap-4 text-xs text-gray-500 mt-1">
                              <span>✓ {planCompliance.administeredCount}</span>
                              <span>✗ {planCompliance.refusedCount}</span>
                              <span>○ {planCompliance.missedCount}</span>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setRecordAdminModal({ isOpen: true, medicationPlan: plan as any })}
                        >
                          Record
                        </Button>
                      </div>
                    );
                  })}
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
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{record.medicationName}</h4>
                            {(record as any).timeOfDay && (
                              <Badge variant="outline" className="text-xs">
                                {(record as any).timeOfDay}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <p><strong>Route:</strong> {(record as any).route || 'N/A'}</p>
                              <p><strong>Date:</strong> {format(new Date((record as any).actualTime || record.scheduledTime), 'MMM dd, yyyy')}</p>
                              <p><strong>Time:</strong> {format(new Date((record as any).actualTime || record.scheduledTime), 'HH:mm')}</p>
                            </div>
                            <div>
                              {record.administratorName && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>Administered by: {record.administratorName}</span>
                                </div>
                              )}
                              {(record as any).wasWitnessed && (
                                <p className="text-green-600 text-xs mt-1">✓ Witnessed</p>
                              )}
                            </div>
                          </div>
                          {record.notes && (
                            <p className="text-sm text-gray-600 mt-2">
                              <strong>Notes:</strong> {record.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={
                            record.result === 'administered' ? 'default' :
                            record.result === 'refused' ? 'destructive' :
                            record.result === 'missed' ? 'secondary' : 'outline'
                          }>
                            {record.result}
                          </Badge>
                          {((record as any).attachmentBeforeUrl || (record as any).attachmentAfterUrl) && (
                            <div className="flex gap-1">
                              {(record as any).attachmentBeforeUrl && (
                                <Badge variant="outline" className="text-xs">Photo Before</Badge>
                              )}
                              {(record as any).attachmentAfterUrl && (
                                <Badge variant="outline" className="text-xs">Photo After</Badge>
                              )}
                            </div>
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