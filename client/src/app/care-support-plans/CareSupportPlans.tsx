import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Calendar, User, Download, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ComprehensiveCarePlanWizardRefactored } from "./components/ComprehensiveCarePlanWizardRefactored";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { canCreateCarePlans, canEditCarePlans } from "@/lib/permissions";
import type { CareSupportPlan } from "@shared/schema";
import { format } from "date-fns";

export function CareSupportPlans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CareSupportPlan | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: carePlans = [], isLoading } = useQuery<CareSupportPlan[]>({
    queryKey: ["/api/care-support-plans"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const response = await apiRequest('DELETE', `/api/care-support-plans/${planId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-support-plans"] });
      toast({
        title: "Plan Deleted",
        description: "Care support plan has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete plan. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Edit and delete handlers
  const handleEditPlan = (plan: CareSupportPlan) => {
    setSelectedPlan(plan);
    setShowEditModal(true);
  };

  const handleDeletePlan = (plan: CareSupportPlan) => {
    if (confirm(`Are you sure you want to delete "${plan.planTitle}"? This action cannot be undone.`)) {
      deletePlanMutation.mutate(plan.id);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedPlan(null);
  };

  const canCreatePlans = canCreateCarePlans(user);
  const canEditPlans = canEditCarePlans(user);

  const filteredPlans = carePlans.filter(plan => {
    if (!searchTerm) return true;
    const client = clients.find((c: any) => c.id === plan.clientId);
    return plan.planTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (client?.fullName || "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  const draftPlans = filteredPlans.filter(plan => plan.status === "draft");
  const activePlans = filteredPlans.filter(plan => plan.status === "active");
  const completedPlans = filteredPlans.filter(plan => plan.status === "completed");

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "draft": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const handleCreatePlan = () => {
    setShowCreateModal(true);
  };

  const handleExportPDF = async (plan: CareSupportPlan) => {
    try {
      const { exportCarePlanToPDF } = await import('@/lib/pdf-export');
      const client = clients.find(c => c.id === plan.clientId);
      await exportCarePlanToPDF(plan, client, user);
      toast({
        title: "PDF exported",
        description: "Care support plan has been exported successfully."
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export care support plan to PDF",
        variant: "destructive"
      });
    }
  };

  const PlansList = ({ plans }: { plans: CareSupportPlan[] }) => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (plans.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Care Support Plans</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first care support plan to get started with NDIS-compliant planning.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const client = clients.find((c: any) => c.id === plan.clientId);
          return (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-base sm:text-lg line-clamp-2">{plan.planTitle}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{client?.fullName || "Unknown Client"}</span>
                    </CardDescription>
                  </div>
                  <Badge className={`${getStatusColor(plan.status)} text-xs flex-shrink-0`}>
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Created: {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Updated: {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : "Unknown"}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleEditPlan(plan)}
                      className="flex items-center justify-center gap-2 w-full"
                    >
                      <FileText className="h-4 w-4" />
                      View Care Plan
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      {canEditPlans && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPlan(plan)}
                          className="flex items-center justify-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportPDF(plan)}
                        className="flex items-center justify-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                      {canEditPlans && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeletePlan(plan)}
                          className="flex items-center justify-center gap-1 col-span-2"
                          disabled={deletePlanMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Care Support Plans</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Create and manage NDIS-compliant care support plans for your clients.
          </p>
        </div>
        {canCreatePlans && (
          <Button onClick={handleCreatePlan} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search plans or clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:max-w-sm"
        />
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">All Plans </span>({filteredPlans.length})
          </TabsTrigger>
          <TabsTrigger value="draft" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Drafts </span>({draftPlans.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Active </span>({activePlans.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Completed </span>({completedPlans.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PlansList plans={filteredPlans} />
        </TabsContent>

        <TabsContent value="draft">
          <PlansList plans={draftPlans} />
        </TabsContent>

        <TabsContent value="active">
          <PlansList plans={activePlans} />
        </TabsContent>

        <TabsContent value="completed">
          <PlansList plans={completedPlans} />
        </TabsContent>
      </Tabs>

      <ComprehensiveCarePlanWizardRefactored 
        open={showCreateModal || showEditModal} 
        onClose={handleCloseModal}
        existingPlan={selectedPlan}
      />
    </div>
  );
}