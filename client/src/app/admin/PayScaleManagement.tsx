import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PayScale {
  id: number;
  tenantId: number;
  level: number;
  payPoint: number;
  hourlyRate: string;
  effectiveDate: string;
  createdAt: string;
}

interface ScHADSRate {
  level: number;
  payPoint: number;
  hourlyRate: number;
  description: string;
}

export default function PayScaleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Fetch current pay scales
  const { data: payScales = [], isLoading: payScalesLoading } = useQuery<PayScale[]>({
    queryKey: ["/api/pay-scales"],
  });

  // Fetch ScHADS default rates
  const { data: scHADSRates = [], isLoading: scHADSLoading } = useQuery<ScHADSRate[]>({
    queryKey: ["/api/schads-rates"],
  });

  // Update pay scale mutation
  const updatePayScaleMutation = useMutation({
    mutationFn: async ({ level, payPoint, hourlyRate }: { level: number; payPoint: number; hourlyRate: number }) => {
      return await apiRequest("PUT", `/api/pay-scales/${level}/${payPoint}`, { hourlyRate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-scales"] });
      toast({
        title: "Success",
        description: "Pay scale updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pay scale",
        variant: "destructive",
      });
    },
  });

  // Reset to ScHADS default mutation
  const resetToScHADSMutation = useMutation({
    mutationFn: async ({ level, payPoint }: { level: number; payPoint: number }) => {
      return await apiRequest("POST", `/api/pay-scales/${level}/${payPoint}/reset`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-scales"] });
      toast({
        title: "Success",
        description: "Pay scale reset to ScHADS default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset pay scale",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (level: number, payPoint: number) => {
    const cellKey = `${level}-${payPoint}`;
    const currentScale = payScales.find(ps => ps.level === level && ps.payPoint === payPoint);
    setEditingCell(cellKey);
    setEditValue(currentScale?.hourlyRate || "");
  };

  const handleSave = (level: number, payPoint: number) => {
    const newRate = parseFloat(editValue);
    if (isNaN(newRate) || newRate <= 0) {
      toast({
        title: "Invalid Rate",
        description: "Please enter a valid hourly rate",
        variant: "destructive",
      });
      return;
    }

    updatePayScaleMutation.mutate({ level, payPoint, hourlyRate: newRate });
    setEditingCell(null);
    setEditValue("");
  };

  const handleCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleReset = (level: number, payPoint: number) => {
    resetToScHADSMutation.mutate({ level, payPoint });
  };

  const getCurrentRate = (level: number, payPoint: number): string => {
    const payScale = payScales.find(ps => ps.level === level && ps.payPoint === payPoint);
    return payScale?.hourlyRate || "0.00";
  };

  const getScHADSRate = (level: number, payPoint: number): number => {
    const scHADSRate = scHADSRates.find(sr => sr.level === level && sr.payPoint === payPoint);
    return scHADSRate?.hourlyRate || 0;
  };

  const getScHADSDescription = (level: number, payPoint: number): string => {
    const scHADSRate = scHADSRates.find(sr => sr.level === level && sr.payPoint === payPoint);
    return scHADSRate?.description || "";
  };

  const isModified = (level: number, payPoint: number): boolean => {
    const currentRate = parseFloat(getCurrentRate(level, payPoint));
    const scHADSRate = getScHADSRate(level, payPoint);
    return Math.abs(currentRate - scHADSRate) > 0.01;
  };

  if (payScalesLoading || scHADSLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-2 text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading pay scales...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ScHADS Pay Scale Management</h2>
          <p className="text-slate-600">Manage award wage rates with manual override capability</p>
        </div>
        <div className="flex items-center space-x-2">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-600">2024-25 Award Rates</span>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pay Scale Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-emerald-500 rounded"></div>
              <span>ScHADS Default Rate</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded"></div>
              <span>Manual Override Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>Click to edit rate</span>
            </div>
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <span>Reset to default</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pay Scale Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Award Wage Matrix</CardTitle>
          <CardDescription>
            Social, Community, Home Care and Disability Services Industry Award 2010
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 border-b font-semibold">Level</th>
                  <th className="text-center p-3 border-b font-semibold">Pay Point 1</th>
                  <th className="text-center p-3 border-b font-semibold">Pay Point 2</th>
                  <th className="text-center p-3 border-b font-semibold">Pay Point 3</th>
                  <th className="text-center p-3 border-b font-semibold">Pay Point 4</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map(level => (
                  <tr key={level} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium">
                      <div>
                        <div className="font-semibold">Level {level}</div>
                        <div className="text-sm text-slate-600">
                          {level === 1 && "Support Worker"}
                          {level === 2 && "Support Worker Grade 2"}
                          {level === 3 && "Coordinator/Team Leader"}
                          {level === 4 && "Manager/Senior Coordinator"}
                        </div>
                      </div>
                    </td>
                    {[1, 2, 3, 4].map(payPoint => {
                      const cellKey = `${level}-${payPoint}`;
                      const isEditing = editingCell === cellKey;
                      const currentRate = getCurrentRate(level, payPoint);
                      const scHADSRate = getScHADSRate(level, payPoint);
                      const modified = isModified(level, payPoint);
                      const description = getScHADSDescription(level, payPoint);

                      return (
                        <td key={payPoint} className="p-3 text-center">
                          <div className="space-y-2">
                            {/* Rate Display/Edit */}
                            {isEditing ? (
                              <div className="space-y-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="text-center"
                                  autoFocus
                                />
                                <div className="flex space-x-1 justify-center">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSave(level, payPoint)}
                                    disabled={updatePayScaleMutation.isPending}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancel}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Button
                                  variant="ghost"
                                  className={`text-lg font-semibold p-2 h-auto w-full ${
                                    modified 
                                      ? "text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200" 
                                      : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                                  }`}
                                  onClick={() => handleEdit(level, payPoint)}
                                >
                                  ${currentRate}
                                </Button>
                                
                                {/* Status Badge */}
                                <div className="flex justify-center">
                                  {modified ? (
                                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Override
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      ScHADS
                                    </Badge>
                                  )}
                                </div>

                                {/* Reset Button (only show if modified) */}
                                {modified && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReset(level, payPoint)}
                                    disabled={resetToScHADSMutation.isPending}
                                    className="text-xs"
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Reset to ${scHADSRate.toFixed(2)}
                                  </Button>
                                )}

                                {/* Description */}
                                {description && (
                                  <div className="text-xs text-slate-500 mt-1 px-2">
                                    {description}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Information Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>System Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">How It Works</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• ScHADS award rates are automatically provisioned as defaults</li>
                <li>• Click any rate to set a manual override</li>
                <li>• Override rates are highlighted in amber</li>
                <li>• Reset button restores ScHADS default rates</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Award Reference</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Social, Community, Home Care and Disability Services Industry Award 2010</li>
                <li>• Rates effective from 1 July 2024</li>
                <li>• Includes minimum wage increases and penalty loadings</li>
                <li>• Automatic timesheet integration</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}