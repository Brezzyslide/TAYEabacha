import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, RefreshCw, AlertCircle, CheckCircle, Clock, Users, UserCheck, Briefcase } from "lucide-react";
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

  // Calculate different employment type rates
  const calculatePartTimeRate = (fullTimeRate: number): number => {
    // Part-time permanent rates are typically the same as full-time under ScHADS
    return fullTimeRate;
  };

  const calculateCasualRate = (permanentRate: number): number => {
    return Math.round((permanentRate * 1.25) * 100) / 100;
  };

  // Update pay scale mutation
  const updatePayScaleMutation = useMutation({
    mutationFn: async ({ level, payPoint, hourlyRate }: { level: number; payPoint: number; hourlyRate: number }) => {
      return await apiRequest("PUT", `/api/pay-scales/${level}/${payPoint}`, { hourlyRate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-scales"] });
      toast({
        title: "Pay scale updated",
        description: "The hourly rate has been successfully updated.",
      });
      setEditingCell(null);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update the pay scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reset pay scales to ScHADS defaults
  const resetPayScalesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/pay-scales/reset");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-scales"] });
      toast({
        title: "Pay scales reset",
        description: "All pay scales have been reset to ScHADS default rates.",
      });
    },
    onError: () => {
      toast({
        title: "Reset failed",
        description: "Failed to reset pay scales. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCellEdit = (level: number, payPoint: number, currentRate: string) => {
    const cellKey = `${level}-${payPoint}`;
    setEditingCell(cellKey);
    setEditValue(currentRate);
  };

  const handleCellSave = (level: number, payPoint: number) => {
    const hourlyRate = parseFloat(editValue);
    if (isNaN(hourlyRate) || hourlyRate <= 0) {
      toast({
        title: "Invalid rate",
        description: "Please enter a valid hourly rate.",
        variant: "destructive",
      });
      return;
    }
    updatePayScaleMutation.mutate({ level, payPoint, hourlyRate });
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const getPayScaleRate = (level: number, payPoint: number): string => {
    const payScale = payScales.find(ps => ps.level === level && ps.payPoint === payPoint);
    return payScale?.hourlyRate || "0.00";
  };

  const getScHADSRate = (level: number, payPoint: number): number => {
    const scHADSRate = scHADSRates.find(sr => sr.level === level && sr.payPoint === payPoint);
    return scHADSRate?.hourlyRate || 0;
  };

  const isOverride = (level: number, payPoint: number): boolean => {
    const currentRate = parseFloat(getPayScaleRate(level, payPoint));
    const defaultRate = getScHADSRate(level, payPoint);
    return Math.abs(currentRate - defaultRate) > 0.01;
  };

  const renderPayScaleTable = (employmentType: "fulltime" | "parttime" | "casual") => {
    const levels = [1, 2, 3, 4];
    const payPoints = [1, 2, 3, 4];

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-slate-300 rounded-lg">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-3 text-left font-semibold">Level / Pay Point</th>
              {payPoints.map(point => (
                <th key={point} className="border border-slate-300 p-3 text-center font-semibold">
                  Pay Point {point}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map(level => (
              <tr key={level} className="hover:bg-slate-50">
                <td className="border border-slate-300 p-3 font-medium bg-slate-50">
                  Level {level}
                </td>
                {payPoints.map(payPoint => {
                  const cellKey = `${level}-${payPoint}`;
                  const isEditing = editingCell === cellKey;
                  const permanentRate = parseFloat(getPayScaleRate(level, payPoint));
                  
                  let displayRate = permanentRate;
                  if (employmentType === "parttime") {
                    displayRate = calculatePartTimeRate(permanentRate);
                  } else if (employmentType === "casual") {
                    displayRate = calculateCasualRate(permanentRate);
                  }

                  const isManualOverride = isOverride(level, payPoint);

                  return (
                    <td key={payPoint} className="border border-slate-300 p-2">
                      <div className="flex items-center justify-between">
                        {isEditing && employmentType === "fulltime" ? (
                          <div className="flex items-center space-x-1 w-full">
                            <Input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-20 h-8 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleCellSave(level, payPoint)}
                              className="h-8 px-2"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCellCancel}
                              className="h-8 px-2"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-sm">
                                ${displayRate.toFixed(2)}
                              </span>
                              {isManualOverride && employmentType === "fulltime" && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                                  Override
                                </Badge>
                              )}
                              {!isManualOverride && employmentType === "fulltime" && (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            {employmentType === "fulltime" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCellEdit(level, payPoint, permanentRate.toString())}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <DollarSign className="h-3 w-3" />
                              </Button>
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
    );
  };

  if (payScalesLoading || scHADSLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
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
          <p className="text-slate-600">Manage award wage rates for different employment types</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-600">2024-25 Award Rates</span>
          </div>
          <Button
            onClick={() => resetPayScalesMutation.mutate()}
            disabled={resetPayScalesMutation.isPending}
            variant="outline"
            size="sm"
          >
            {resetPayScalesMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Reset to Defaults
          </Button>
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

      {/* Employment Type Information */}
      <Card>
        <CardHeader>
          <CardTitle>ScHADS Employment Types</CardTitle>
          <CardDescription>
            Social, Community, Home Care and Disability Services Industry Award 2010
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Full-Time Permanent</h3>
              </div>
              <p className="text-sm text-blue-700">
                Standard ScHADS rates for full-time ongoing employees. Editable with manual override.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Part-Time Permanent</h3>
              </div>
              <p className="text-sm text-green-700">
                Same rates as full-time permanent under ScHADS award structure.
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-orange-900">Casual Employees</h3>
              </div>
              <p className="text-sm text-orange-700">
                Permanent rates plus 25% casual loading as per ScHADS award.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pay Scale Matrix with Employment Type Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Award Wage Matrix - ScHADS 2024-25</CardTitle>
          <CardDescription>
            Level 1-4, Pay Point 1-4 structure. Full-time rates are editable, others calculated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="fulltime" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="fulltime" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Full-Time Permanent
              </TabsTrigger>
              <TabsTrigger value="parttime" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Part-Time Permanent
              </TabsTrigger>
              <TabsTrigger value="casual" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Casual (+25%)
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="fulltime">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Full-Time Permanent Employee Rates</h3>
                  </div>
                  <p className="text-sm text-blue-700">
                    Standard ScHADS award rates for full-time ongoing employees. 
                    Click any rate to edit with manual override capability.
                  </p>
                </div>
                <div className="group">
                  {renderPayScaleTable("fulltime")}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="parttime">
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">Part-Time Permanent Employee Rates</h3>
                  </div>
                  <p className="text-sm text-green-700">
                    Under the ScHADS award, part-time permanent employees receive the same hourly rates as full-time permanent employees.
                    These rates are automatically synchronized with the full-time rates.
                  </p>
                </div>
                {renderPayScaleTable("parttime")}
              </div>
            </TabsContent>
            
            <TabsContent value="casual">
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-orange-900">Casual Employee Rates (25% Loading)</h3>
                  </div>
                  <p className="text-sm text-orange-700">
                    Casual employees receive the permanent employee rate plus 25% casual loading as mandated by the ScHADS award.
                    These rates are automatically calculated from the permanent rates.
                  </p>
                </div>
                {renderPayScaleTable("casual")}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}