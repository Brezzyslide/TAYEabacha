import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, TrendingDown, AlertTriangle } from "lucide-react";
import { useState } from "react";
import ParticipantBudgetForm from "./components/ParticipantBudgetForm";
import BudgetSummaryCard from "./components/BudgetSummaryCard";
import BudgetTransactionsList from "./components/BudgetTransactionsList";
import NDISPricingManager from "./components/NDISPricingManager";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/auth/permissions";

interface NdisBudget {
  id: number;
  clientId: number;
  companyId: string;
  silTotal: string;
  silRemaining: string;
  silAllowedRatios: string[];
  communityAccessTotal: string;
  communityAccessRemaining: string;
  communityAccessAllowedRatios: string[];
  capacityBuildingTotal: string;
  capacityBuildingRemaining: string;
  capacityBuildingAllowedRatios: string[];
  priceOverrides?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BudgetDashboard() {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<NdisBudget | null>(null);

  const { data: budgets = [], isLoading } = useQuery<NdisBudget[]>({
    queryKey: ["/api/ndis-budgets"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const canEditBudgets = hasPermission(user, "canEditBudget");
  const canViewPricing = hasPermission(user, "canViewPricing");
  
  console.log("Budget Dashboard - User:", user?.role);
  console.log("Budget Dashboard - canEditBudgets:", canEditBudgets);
  console.log("Budget Dashboard - showCreateForm:", showCreateForm);

  const getTotalBudgetValue = (budgets: NdisBudget[]) => {
    return budgets.reduce((total, budget) => {
      return total + 
        parseFloat(budget.silTotal || "0") + 
        parseFloat(budget.communityAccessTotal || "0") + 
        parseFloat(budget.capacityBuildingTotal || "0");
    }, 0);
  };

  const getTotalRemainingValue = (budgets: NdisBudget[]) => {
    return budgets.reduce((total, budget) => {
      return total + 
        parseFloat(budget.silRemaining || "0") + 
        parseFloat(budget.communityAccessRemaining || "0") + 
        parseFloat(budget.capacityBuildingRemaining || "0");
    }, 0);
  };

  const totalBudget = getTotalBudgetValue(budgets);
  const totalRemaining = getTotalRemainingValue(budgets);
  const totalUsed = totalBudget - totalRemaining;
  const utilizationRate = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">NDIS Budget Management</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">NDIS Budget Management</h1>
        {canEditBudgets && (
          <Button onClick={() => {
            console.log("Create Budget button clicked");
            setShowCreateForm(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Budget
          </Button>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across {budgets.length} participants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Remaining</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalRemaining.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Available for services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Used</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {utilizationRate.toFixed(1)}% utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Budgets</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {budgets.filter(b => {
                const totalRemaining = parseFloat(b.silRemaining || "0") + 
                  parseFloat(b.communityAccessRemaining || "0") + 
                  parseFloat(b.capacityBuildingRemaining || "0");
                const totalBudget = parseFloat(b.silTotal || "0") + 
                  parseFloat(b.communityAccessTotal || "0") + 
                  parseFloat(b.capacityBuildingTotal || "0");
                return totalBudget > 0 && (totalRemaining / totalBudget) < 0.2;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Below 20% remaining
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="budgets" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="budgets">Participant Budgets</TabsTrigger>
          <TabsTrigger value="transactions">Budget Transactions</TabsTrigger>
          {canViewPricing && <TabsTrigger value="pricing">NDIS Pricing</TabsTrigger>}
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {budgets.map((budget) => {
              const client = clients.find(c => c.id === budget.clientId);
              return (
                <BudgetSummaryCard
                  key={budget.id}
                  budget={budget}
                  client={client}
                  onEdit={() => setSelectedBudget(budget)}
                  canEdit={canEditBudgets}
                />
              );
            })}
            
            {budgets.length === 0 && (
              <div className="col-span-full text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets found</h3>
                <p className="text-gray-500 mb-4">Start by creating a budget for a participant.</p>
                {canEditBudgets && (
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Budget
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <BudgetTransactionsList />
        </TabsContent>

        {canViewPricing && (
          <TabsContent value="pricing">
            <NDISPricingManager />
          </TabsContent>
        )}

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Budget Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Budget reporting features coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Budget Modal */}
      {(showCreateForm || selectedBudget) && (
        <ParticipantBudgetForm
          budget={selectedBudget}
          onClose={() => {
            console.log("Closing budget form");
            setShowCreateForm(false);
            setSelectedBudget(null);
          }}
          onSuccess={() => {
            console.log("Budget form success");
            setShowCreateForm(false);
            setSelectedBudget(null);
          }}
        />
      )}
    </div>
  );
}