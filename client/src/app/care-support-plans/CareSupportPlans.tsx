import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText, Calendar, User, Download, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { SimplifiedCarePlanWizard } from "./components/SimplifiedCarePlanWizard";
import { useAuth } from "@/hooks/use-auth";
import type { CareSupportPlan } from "@shared/schema";
import { format } from "date-fns";

export function CareSupportPlans() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: carePlans = [], isLoading } = useQuery<CareSupportPlan[]>({
    queryKey: ["/api/care-support-plans"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const canCreatePlans = user && (user.role === "TeamLeader" || user.role === "Coordinator" || user.role === "Admin" || user.role === "admin" || user.role === "ConsoleManager");
  const canEditPlans = user && (user.role === "TeamLeader" || user.role === "Coordinator" || user.role === "Admin" || user.role === "admin" || user.role === "ConsoleManager");

  const filteredPlans = carePlans.filter((plan: CareSupportPlan) => {
    const client = clients.find((c: any) => c.id === plan.clientId);
    const clientName = client ? client.fullName : "";
    return (
      plan.planTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "draft": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const handleCreatePlan = () => {
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
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
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (plans.length === 0) {
      return (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No care support plans found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? "No plans match your search criteria." : "Create your first care support plan to get started."}
            </p>
            {canCreatePlans && !searchTerm && (
              <Button onClick={handleCreatePlan} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create First Plan
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {plans.map((plan) => {
          const client = clients.find((c: any) => c.id === plan.clientId);
          const clientName = client ? client.fullName : `Client #${plan.clientId}`;
          
          return (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{plan.planTitle}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {clientName}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(plan.status || "draft")}>
                      {plan.status || "draft"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Created {plan.createdAt ? format(new Date(plan.createdAt), "MMM d, yyyy") : "Unknown"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Care Support Plans</h1>
          <p className="text-muted-foreground">
            NDIS-compliant care planning with AI-powered content generation
          </p>
        </div>
        {canCreatePlans && (
          <Button onClick={handleCreatePlan} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Plans</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          <Input
            placeholder="Search plans or clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <TabsContent value="all" className="space-y-4">
          <PlansList plans={filteredPlans} />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <PlansList plans={filteredPlans.filter((plan: CareSupportPlan) => plan.status === "active")} />
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          <PlansList plans={filteredPlans.filter((plan: CareSupportPlan) => plan.status === "draft")} />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <PlansList plans={filteredPlans.filter((plan: CareSupportPlan) => plan.status === "completed")} />
        </TabsContent>
      </Tabs>
      
      <SimplifiedCarePlanWizard 
        open={showCreateModal} 
        onClose={handleCloseModal}
      />
    </div>
  );
}

interface CareSupportPlansListProps {
  plans: CareSupportPlan[];
  clients: any[];
  isLoading: boolean;
  canEditPlans: boolean;
  onEditPlan: (plan: CareSupportPlan) => void;
}

function CareSupportPlansList({ plans, clients, isLoading, canEditPlans, onEditPlan }: CareSupportPlansListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "draft": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
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
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No care support plans found</h3>
          <p className="text-muted-foreground text-center">
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
                    Created: {new Date(plan.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-3 w-3" />
                    Updated: {new Date(plan.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {canEditPlans && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditPlan(plan)}
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
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      <SimplePlanModal 
        open={showCreateModal} 
        onClose={handleCloseModal}
      />
    </div>
  );
}