import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download, TrendingDown, DollarSign, Clock } from "lucide-react";
import { format } from "date-fns";

interface BudgetTransaction {
  id: number;
  budgetId: number;
  shiftId?: number;
  caseNoteId?: number;
  category: string;
  shiftType: string;
  ratio: string;
  hours: string;
  rate: string;
  amount: string;
  description?: string;
  transactionType: string;
  createdAt: string;
  createdBy?: {
    id: number;
    fullName: string;
    username: string;
  };
}

export default function BudgetTransactionsList() {
  const [selectedBudget, setSelectedBudget] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: budgets = [] } = useQuery<any[]>({
    queryKey: ["/api/ndis-budgets"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Mock transactions data for now - in real app would fetch from API
  const transactions: BudgetTransaction[] = [];

  const filteredTransactions = transactions.filter(transaction => {
    const matchesBudget = selectedBudget === "all" || transaction.budgetId.toString() === selectedBudget;
    const matchesCategory = categoryFilter === "all" || transaction.category === categoryFilter;
    const matchesSearch = !searchTerm || 
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesBudget && matchesCategory && matchesSearch;
  });

  const totalTransactions = filteredTransactions.length;
  const totalAmount = filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "SIL": return "bg-blue-100 text-blue-800";
      case "CommunityAccess": return "bg-green-100 text-green-800";
      case "CapacityBuilding": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "deduction": return "bg-red-100 text-red-800";
      case "adjustment": return "bg-yellow-100 text-yellow-800";
      case "refund": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getClientName = (budgetId: number) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return "Unknown Client";
    
    const client = clients.find(c => c.id === budget.clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              In current view
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Budget deductions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Transaction</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalTransactions > 0 ? (totalAmount / totalTransactions).toFixed(2) : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Budget Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedBudget} onValueChange={setSelectedBudget}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {budgets.map((budget) => {
                  const client = clients.find(c => c.id === budget.clientId);
                  return (
                    <SelectItem key={budget.id} value={budget.id.toString()}>
                      {client ? `${client.firstName} ${client.lastName}` : `Budget ${budget.id}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="SIL">SIL</SelectItem>
                <SelectItem value="CommunityAccess">Community Access</SelectItem>
                <SelectItem value="CapacityBuilding">Capacity Building</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>

          {/* Transactions Table */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
              <p className="text-gray-500">
                {transactions.length === 0 
                  ? "Budget transactions will appear here when services are delivered and case notes are completed."
                  : "Try adjusting your filters to see more transactions."
                }
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Shift Type</TableHead>
                    <TableHead>Ratio</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {format(new Date(transaction.createdAt), "MMM d, yyyy")}
                        <div className="text-xs text-gray-500">
                          {format(new Date(transaction.createdAt), "h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>{getClientName(transaction.budgetId)}</TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(transaction.category)}>
                          {transaction.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.shiftType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.ratio}</Badge>
                      </TableCell>
                      <TableCell>{parseFloat(transaction.hours).toFixed(2)}h</TableCell>
                      <TableCell>${parseFloat(transaction.rate).toFixed(2)}</TableCell>
                      <TableCell className="font-medium">
                        ${parseFloat(transaction.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTransactionTypeColor(transaction.transactionType)}>
                          {transaction.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {transaction.description || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}