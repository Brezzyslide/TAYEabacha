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

  const canCreatePlans = user && (user.role === "TeamLeader" || user.role === "Coordinator" || user.role === "Admin" || user.role === "admin" || user.role === "ConsoleManager");
  const canEditPlans = user && (user.role === "TeamLeader" || user.role === "Coordinator" || user.role === "Admin" || user.role === "admin" || user.role === "ConsoleManager");

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const client = clients.find((c: any) => c.id === plan.clientId);
          return (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{plan.planTitle}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {client?.fullName || "Unknown Client"}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(plan.status)}>
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Created: {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : "Unknown"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" />
                      Updated: {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : "Unknown"}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {canEditPlans && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPlan(plan)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                    {canEditPlans && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePlan(plan)}
                        className="flex items-center gap-1"
                        disabled={deletePlanMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    )}
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Care Support Plans</h1>
          <p className="text-muted-foreground">
            Create and manage NDIS-compliant care support plans for your clients.
          </p>
        </div>
        {canCreatePlans && (
          <Button onClick={handleCreatePlan}>
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
          className="max-w-sm"
        />
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Plans ({filteredPlans.length})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({draftPlans.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activePlans.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedPlans.length})</TabsTrigger>
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