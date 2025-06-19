import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, DollarSign, TrendingDown, AlertTriangle, Search, Filter } from "lucide-react";
import { useState, useMemo } from "react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const { data: budgets = [], isLoading } = useQuery<NdisBudget[]>({
    queryKey: ["/api/ndis-budgets"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const canEditBudgets = hasPermission(user, "canEditBudget");
  const canViewPricing = hasPermission(user, "canViewPricing");

  // Filter budgets based on search term and selected client
  const filteredBudgets = useMemo(() => {
    let filtered = budgets;

    // Filter by selected client
    if (selectedClient !== "all") {
      filtered = filtered.filter(budget => budget.clientId.toString() === selectedClient);
    }

    // Filter by search term (client name)
    if (searchTerm.trim()) {
      filtered = filtered.filter(budget => {
        const client = clients.find(c => c.id === budget.clientId);
        const clientName = client ? `${client.firstName} ${client.lastName}`.toLowerCase() : "";
        return clientName.includes(searchTerm.toLowerCase());
      });
    }

    return filtered;
  }, [budgets, clients, selectedClient, searchTerm]);


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
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h1 className="text-xl sm:text-3xl font-bold">NDIS Budget Management</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2 sm:pb-4">
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-3xl font-bold">NDIS Budget Management</h1>
        {canEditBudgets && (
          <Button onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Create </span>Budget
          </Button>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1 sm:pt-2">
            <div className="text-lg sm:text-2xl font-bold">${totalBudget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across {budgets.length} participants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Remaining</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-1 sm:pt-2">
            <div className="text-lg sm:text-2xl font-bold text-green-600">${totalRemaining.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Available for services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Used</CardTitle>
            <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
          </CardHeader>
          <CardContent className="pt-1 sm:pt-2">
            <div className="text-lg sm:text-2xl font-bold text-red-600">${totalUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {utilizationRate.toFixed(1)}% utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Low Budgets</CardTitle>
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
          </CardHeader>
          <CardContent className="pt-1 sm:pt-2">
            <div className="text-lg sm:text-2xl font-bold text-yellow-600">
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="budgets" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <span className="hidden sm:inline">Participant </span>Budgets
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <span className="hidden sm:inline">Budget </span>Transactions
          </TabsTrigger>
          {canViewPricing && (
            <TabsTrigger value="pricing" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
              <span className="hidden sm:inline">NDIS </span>Pricing
            </TabsTrigger>
          )}
          <TabsTrigger value="reports" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-4 sm:space-y-6 mt-3 sm:mt-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-center flex-1">
              <div className="relative w-full sm:flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by client name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.firstName} {client.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              Showing {filteredBudgets.length} of {budgets.length} budgets
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredBudgets.map((budget) => {
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
            
            {filteredBudgets.length === 0 && searchTerm && (
              <div className="col-span-full text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets found</h3>
                <p className="text-gray-500 mb-4">No budgets match your search criteria.</p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedClient("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
            
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
            setShowCreateForm(false);
            setSelectedBudget(null);
          }}
          onSuccess={() => {
            setShowCreateForm(false);
            setSelectedBudget(null);
          }}
        />
      )}
    </div>
  );
}