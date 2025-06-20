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
  employmentType: string;
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

const EMPLOYMENT_TYPES = [
  { 
    value: "fulltime", 
    label: "Full-Time", 
    icon: Users, 
    description: "Permanent full-time employees",
    multiplier: 1.0
  },
  { 
    value: "parttime", 
    label: "Part-Time", 
    icon: Clock, 
    description: "Permanent part-time employees",
    multiplier: 1.0
  },
  { 
    value: "casual", 
    label: "Casual", 
    icon: UserCheck, 
    description: "Casual employees with 25% loading",
    multiplier: 1.25
  }
];

export default function PayScaleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});
  const [activeEmploymentType, setActiveEmploymentType] = useState("fulltime");

  // Fetch pay scales for current employment type
  const { data: payScales = [], isLoading } = useQuery({
    queryKey: ["/api/pay-scales", activeEmploymentType],
    queryFn: () => apiRequest("GET", `/api/pay-scales?employmentType=${activeEmploymentType}`),
  });

  // Fetch ScHADS default rates
  const { data: scHADSRates = [] } = useQuery<ScHADSRate[]>({
    queryKey: ["/api/schads-rates"],
  });

  // Update pay scale mutation
  const updatePayScaleMutation = useMutation({
    mutationFn: ({ level, payPoint, hourlyRate, employmentType }: { 
      level: number; 
      payPoint: number; 
      hourlyRate: number;
      employmentType: string;
    }) =>
      apiRequest("PUT", `/api/pay-scales/${level}/${payPoint}`, { 
        hourlyRate, 
        employmentType 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-scales"] });
      toast({
        title: "Pay scale updated",
        description: "The hourly rate has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pay scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reset to ScHADS default mutation
  const resetToDefaultMutation = useMutation({
    mutationFn: ({ level, payPoint }: { level: number; payPoint: number }) =>
      apiRequest("POST", `/api/pay-scales/${level}/${payPoint}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-scales"] });
      toast({
        title: "Reset successful",
        description: "Pay scale has been reset to ScHADS default rate.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset pay scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reset all scales mutation
  const resetAllScalesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pay-scales/reset"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-scales"] });
      toast({
        title: "All scales reset",
        description: "All pay scales have been reset to ScHADS default rates.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset all pay scales. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getScHADSRate = (level: number, payPoint: number): number => {
    const rate = scHADSRates.find(r => r.level === level && r.payPoint === payPoint);
    return rate ? rate.hourlyRate : 0;
  };

  const getAdjustedRate = (baseRate: number, employmentType: string): number => {
    const typeConfig = EMPLOYMENT_TYPES.find(t => t.value === employmentType);
    return baseRate * (typeConfig?.multiplier || 1.0);
  };

  const isOverridden = (level: number, payPoint: number): boolean => {
    const currentRate = parseFloat(
      payScales.find(p => p.level === level && p.payPoint === payPoint)?.hourlyRate || "0"
    );
    const scHADSRate = getScHADSRate(level, payPoint);
    const expectedRate = getAdjustedRate(scHADSRate, activeEmploymentType);
    
    return Math.abs(currentRate - expectedRate) > 0.01;
  };

  const handleRateChange = (level: number, payPoint: number, value: string) => {
    const key = `${level}-${payPoint}`;
    setEditingRates(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveRate = (level: number, payPoint: number) => {
    const key = `${level}-${payPoint}`;
    const newRate = parseFloat(editingRates[key]);
    
    if (isNaN(newRate) || newRate <= 0) {
      toast({
        title: "Invalid rate",
        description: "Please enter a valid hourly rate.",
        variant: "destructive",
      });
      return;
    }

    updatePayScaleMutation.mutate({ 
      level, 
      payPoint, 
      hourlyRate: newRate,
      employmentType: activeEmploymentType
    });
    
    setEditingRates(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleResetToDefault = (level: number, payPoint: number) => {
    resetToDefaultMutation.mutate({ level, payPoint });
  };

  const getCurrentRate = (level: number, payPoint: number): string => {
    const key = `${level}-${payPoint}`;
    if (editingRates[key] !== undefined) {
      return editingRates[key];
    }
    return payScales.find(p => p.level === level && p.payPoint === payPoint)?.hourlyRate || "0.00";
  };

  const currentEmploymentType = EMPLOYMENT_TYPES.find(t => t.value === activeEmploymentType);

  if (isLoading) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pay Scale Management</h2>
          <p className="text-muted-foreground">
            Manage ScHADS award rates by employment type
          </p>
        </div>
        <Button
          onClick={() => resetAllScalesMutation.mutate()}
          disabled={resetAllScalesMutation.isPending}
          variant="outline"
          className="flex items-center space-x-2"
        >
          {resetAllScalesMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span>Reset All to ScHADS</span>
        </Button>
      </div>

      {/* Employment Type Tabs */}
      <Tabs value={activeEmploymentType} onValueChange={setActiveEmploymentType}>
        <TabsList className="grid w-full grid-cols-3">
          {EMPLOYMENT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <TabsTrigger 
                key={type.value} 
                value={type.value}
                className="flex items-center space-x-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{type.label}</span>
                <span className="sm:hidden">{type.label.split('-')[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {EMPLOYMENT_TYPES.map((employmentType) => (
          <TabsContent key={employmentType.value} value={employmentType.value}>
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <employmentType.icon className="h-5 w-5" />
                  <CardTitle>{employmentType.label} Employees</CardTitle>
                </div>
                <CardDescription>
                  {employmentType.description}
                  {employmentType.multiplier !== 1.0 && (
                    <span className="ml-2 text-amber-600 font-medium">
                      ({((employmentType.multiplier - 1) * 100).toFixed(0)}% loading applied)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Level</th>
                        <th className="text-left p-3 font-medium">Pay Point 1</th>
                        <th className="text-left p-3 font-medium">Pay Point 2</th>
                        <th className="text-left p-3 font-medium">Pay Point 3</th>
                        <th className="text-left p-3 font-medium">Pay Point 4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map((level) => (
                        <tr key={level} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">Level {level}</td>
                          {[1, 2, 3, 4].map((payPoint) => {
                            const key = `${level}-${payPoint}`;
                            const isEditing = editingRates[key] !== undefined;
                            const currentRate = getCurrentRate(level, payPoint);
                            const scHADSRate = getScHADSRate(level, payPoint);
                            const expectedRate = getAdjustedRate(scHADSRate, employmentType.value);
                            const isModified = isOverridden(level, payPoint);

                            return (
                              <td key={payPoint} className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    {isEditing ? (
                                      <div className="flex items-center space-x-1">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={editingRates[key]}
                                          onChange={(e) => handleRateChange(level, payPoint, e.target.value)}
                                          className="w-20 h-8"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              handleSaveRate(level, payPoint);
                                            } else if (e.key === 'Escape') {
                                              setEditingRates(prev => {
                                                const updated = { ...prev };
                                                delete updated[key];
                                                return updated;
                                              });
                                            }
                                          }}
                                          autoFocus
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-1">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        <span
                                          className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                                          onClick={() => handleRateChange(level, payPoint, currentRate)}
                                        >
                                          {parseFloat(currentRate).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {isModified && !isEditing && (
                                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                                        Override
                                      </Badge>
                                    )}
                                  </div>

                                  {isEditing && (
                                    <div className="flex space-x-1">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveRate(level, payPoint)}
                                        disabled={updatePayScaleMutation.isPending}
                                      >
                                        <CheckCircle className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingRates(prev => {
                                            const updated = { ...prev };
                                            delete updated[key];
                                            return updated;
                                          });
                                        }}
                                      >
                                        <AlertCircle className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}

                                  {!isEditing && (
                                    <div className="flex space-x-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRateChange(level, payPoint, currentRate)}
                                      >
                                        Edit
                                      </Button>
                                      {isModified && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleResetToDefault(level, payPoint)}
                                          disabled={resetToDefaultMutation.isPending}
                                        >
                                          Reset
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  <div className="text-xs text-muted-foreground">
                                    ScHADS: ${expectedRate.toFixed(2)}
                                  </div>
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
          </TabsContent>
        ))}
      </Tabs>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Briefcase className="h-5 w-5" />
            <span>Pay Scale Legend</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                Default
              </Badge>
              <span className="text-sm">ScHADS standard rate</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                Override
              </Badge>
              <span className="text-sm">Manual rate override</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                Loading
              </Badge>
              <span className="text-sm">Casual 25% loading applied</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Click on any rate to edit. Casual rates automatically include 25% loading on top of ScHADS rates.
            Use the Reset button to restore ScHADS default rates for individual positions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}