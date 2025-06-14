import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Edit, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface BudgetSummaryCardProps {
  budget: {
    id: number;
    clientId: number;
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
    createdAt: string;
    updatedAt: string;
  };
  client?: {
    id: number;
    firstName: string;
    lastName: string;
    clientId: string;
  };
  onEdit: () => void;
  canEdit: boolean;
}

export default function BudgetSummaryCard({ budget, client, onEdit, canEdit }: BudgetSummaryCardProps) {
  const silTotal = parseFloat(budget.silTotal || "0");
  const silRemaining = parseFloat(budget.silRemaining || "0");
  const silUsed = silTotal - silRemaining;
  const silProgress = silTotal > 0 ? (silUsed / silTotal) * 100 : 0;

  const communityTotal = parseFloat(budget.communityAccessTotal || "0");
  const communityRemaining = parseFloat(budget.communityAccessRemaining || "0");
  const communityUsed = communityTotal - communityRemaining;
  const communityProgress = communityTotal > 0 ? (communityUsed / communityTotal) * 100 : 0;

  const capacityTotal = parseFloat(budget.capacityBuildingTotal || "0");
  const capacityRemaining = parseFloat(budget.capacityBuildingRemaining || "0");
  const capacityUsed = capacityTotal - capacityRemaining;
  const capacityProgress = capacityTotal > 0 ? (capacityUsed / capacityTotal) * 100 : 0;

  const totalBudget = silTotal + communityTotal + capacityTotal;
  const totalRemaining = silRemaining + communityRemaining + capacityRemaining;
  const totalUsed = totalBudget - totalRemaining;
  const overallProgress = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

  const isLowBudget = totalBudget > 0 && (totalRemaining / totalBudget) < 0.2;
  const isOverBudget = silRemaining < 0 || communityRemaining < 0 || capacityRemaining < 0;

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return "bg-red-500";
    if (progress >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStatusBadge = () => {
    if (isOverBudget) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Over Budget
      </Badge>;
    }
    if (isLowBudget) {
      return <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
        <TrendingDown className="h-3 w-3" />
        Low Budget
      </Badge>;
    }
    return <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800">
      <TrendingUp className="h-3 w-3" />
      Healthy
    </Badge>;
  };

  return (
    <Card className={`relative ${isOverBudget ? 'border-red-200 bg-red-50' : isLowBudget ? 'border-yellow-200 bg-yellow-50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {client ? `${client.firstName} ${client.lastName}` : `Client ID: ${budget.clientId}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {client && (
          <p className="text-sm text-gray-500">Client ID: {client.clientId}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Overall Budget Progress</span>
            <span className="text-sm text-gray-500">{overallProgress.toFixed(1)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Used: ${totalUsed.toLocaleString()}</span>
            <span>Total: ${totalBudget.toLocaleString()}</span>
          </div>
        </div>

        {/* SIL Category */}
        {silTotal > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">SIL</span>
              <span className="text-sm text-gray-500">${silRemaining.toLocaleString()} remaining</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getProgressColor(silProgress)}`}
                style={{ width: `${Math.min(silProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Ratios: {budget.silAllowedRatios.join(", ")}</span>
              <span>${silTotal.toLocaleString()} total</span>
            </div>
          </div>
        )}

        {/* Community Access Category */}
        {communityTotal > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Community Access</span>
              <span className="text-sm text-gray-500">${communityRemaining.toLocaleString()} remaining</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getProgressColor(communityProgress)}`}
                style={{ width: `${Math.min(communityProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Ratios: {budget.communityAccessAllowedRatios.join(", ")}</span>
              <span>${communityTotal.toLocaleString()} total</span>
            </div>
          </div>
        )}

        {/* Capacity Building Category */}
        {capacityTotal > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Capacity Building</span>
              <span className="text-sm text-gray-500">${capacityRemaining.toLocaleString()} remaining</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getProgressColor(capacityProgress)}`}
                style={{ width: `${Math.min(capacityProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Ratios: {budget.capacityBuildingAllowedRatios.join(", ")}</span>
              <span>${capacityTotal.toLocaleString()} total</span>
            </div>
          </div>
        )}

        {/* Price Overrides Indicator */}
        {budget.priceOverrides && Object.keys(budget.priceOverrides).length > 0 && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            Custom pricing rules applied
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-400 pt-2 border-t">
          Last updated: {new Date(budget.updatedAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}