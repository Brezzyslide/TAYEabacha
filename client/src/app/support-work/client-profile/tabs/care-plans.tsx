import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, FileText, Calendar, User, Download, Edit, Plus } from "lucide-react";
import { ComprehensiveCarePlanWizardRefactored } from "@/app/care-support-plans/components/ComprehensiveCarePlanWizardRefactored";
import { SimplePlanModal } from "@/app/care-support-plans/components/SimplePlanModal";
import { useAuth } from "@/hooks/use-auth";
import type { CareSupportPlan } from "@shared/schema";
import { format } from "date-fns";

interface CarePlansTabProps {
  clientId: string;
  companyId: string;
}

export default function CarePlansTab({ clientId, companyId }: CarePlansTabProps) {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CareSupportPlan | null>(null);

  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  // Fetch care plans filtered by client ID
  const { data: carePlans = [], isLoading } = useQuery<CareSupportPlan[]>({
    queryKey: ["/api/care-support-plans", clientId],
    select: (data) => data.filter(plan => plan.clientId === parseInt(clientId))
  });

  // Fetch client data for display
  const { data: client } = useQuery<any>({
    queryKey: [`/api/clients/${clientId}`]
  });

  const canCreatePlans = user && (user.role === "TeamLeader" || user.role === "Coordinator" || user.role === "Admin" || user.role === "admin" || user.role === "ConsoleManager");

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

  const handleViewPlan = (plan: CareSupportPlan) => {
    setSelectedPlan(plan);
    setShowViewModal(true);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowViewModal(false);
    setSelectedPlan(null);
  };

  const handleExportPDF = async (plan: CareSupportPlan) => {
    try {
      const { exportCarePlanToPDF } = await import('@/lib/pdf-export');
      await exportCarePlanToPDF(plan, client, user);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const draftPlans = carePlans.filter(plan => plan.status === "draft");
  const activePlans = carePlans.filter(plan => plan.status === "active");
  const completedPlans = carePlans.filter(plan => plan.status === "completed");

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
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (plans.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Care Plans</h3>
            <p className="text-gray-600 mb-4">
              {client ? `No care plans found for ${client.firstName} ${client.lastName}.` : "No care plans found for this client."}
            </p>
            {canCreatePlans && (
              <Button onClick={handleCreatePlan} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create First Care Plan
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{plan.planTitle}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {client ? `${client.firstName} ${client.lastName}` : `Client #${plan.clientId}`}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(plan.status)}>
                  {plan.status || "draft"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Created: {plan.createdAt ? format(new Date(plan.createdAt), "MMM d, yyyy") : "Unknown"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-3 w-3" />
                    Updated: {plan.updatedAt ? format(new Date(plan.updatedAt), "MMM d, yyyy") : "Unknown"}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleViewPlan(plan)}
                    className="flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    View Care Plan
                  </Button>
                  {canCreatePlans && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPlan(plan)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportPDF(plan)}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Care Support Plans</h2>
          <p className="text-muted-foreground">
            NDIS-compliant care plans for {client ? `${client.firstName} ${client.lastName}` : "this client"}
          </p>
        </div>
        {canCreatePlans && (
          <Button onClick={handleCreatePlan} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Care Plan
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Plans ({carePlans.length})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({draftPlans.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activePlans.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedPlans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PlansList plans={carePlans} />
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

      <SimplePlanModal 
        open={showCreateModal} 
        onClose={handleCloseModals}
      />
      
      {selectedPlan && (
        <ComprehensiveCarePlanWizardRefactored
          open={showViewModal}
          onClose={handleCloseModals}
          existingPlan={selectedPlan}
        />
      )}
    </div>
  );
}