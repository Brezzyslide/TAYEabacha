import { useState } from "react";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, DollarSign, Calendar, Save, Plus, Trash2, Building } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

interface BillingConfiguration {
  rates: Record<string, number>;
  cycleDays: number;
  nextBillingDate: string;
  isActive: boolean;
}

export default function BillingConfigurationDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [cycleDays, setCycleDays] = useState(28);
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [newRoleType, setNewRoleType] = useState("");
  const [newRoleRate, setNewRoleRate] = useState("");
  const [selectedStaffType, setSelectedStaffType] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current billing configuration
  const { data: config, isLoading } = useQuery<BillingConfiguration>({
    queryKey: ["/api/billing/configuration"],
    enabled: isOpen,
  });

  // Get all staff types across tenants
  const { data: staffTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/billing/staff-types"],
    enabled: isOpen,
  });

  // Get staff statistics by tenant
  const { data: staffStats = [] } = useQuery<any[]>({
    queryKey: ["/api/billing/staff-statistics"],
    enabled: isOpen,
  });

  // Get all staff types across tenants
  const { data: allStaffTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/billing/staff-types"],
    enabled: isOpen,
  });

  // Get staff statistics by tenant
  const { data: staffStats = [] } = useQuery<any[]>({
    queryKey: ["/api/billing/staff-statistics"],
    enabled: isOpen,
  });

  // Update local state when config loads
  React.useEffect(() => {
    if (config && isOpen) {
      setRates(config.rates || {});
      setCycleDays(config.cycleDays || 28);
      setNextBillingDate(config.nextBillingDate || "");
      setIsActive(config.isActive ?? true);
    }
  }, [config, isOpen]);

  // Update billing configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (configData: Partial<BillingConfiguration>) => {
      return apiRequest("POST", "/api/billing/configuration", configData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/configuration"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/billing-overview"] });
      toast({
        title: "Success",
        description: "Billing configuration updated successfully",
      });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update billing configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateConfigMutation.mutate({
      rates,
      cycleDays,
      nextBillingDate,
      isActive
    });
  };

  const handleRateChange = (role: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates(prev => ({
      ...prev,
      [role]: numValue
    }));
  };

  const handleAddRole = () => {
    if (newRoleType.trim() && newRoleRate.trim()) {
      const rate = parseFloat(newRoleRate) || 0;
      setRates(prev => ({
        ...prev,
        [newRoleType.trim()]: rate
      }));
      setNewRoleType("");
      setNewRoleRate("");
    }
  };

  const handleRemoveRole = (role: string) => {
    setRates(prev => {
      const newRates = { ...prev };
      delete newRates[role];
      return newRates;
    });
  };

  const calculateNextBillingDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + cycleDays);
    setNextBillingDate(date.toISOString().split('T')[0]);
  };

  return (
    <PermissionGuard requiredPermissions={["ConsoleManager"]}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure Billing
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Billing Configuration
            </DialogTitle>
            <DialogDescription>
              Set custom pricing rates and billing cycles for all user roles.
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="py-8 text-center">Loading configuration...</div>
          ) : (
            <div className="space-y-6">
              {/* Billing Cycle Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Billing Cycle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cycleDays">Cycle Length (Days)</Label>
                      <Input
                        id="cycleDays"
                        type="number"
                        value={cycleDays}
                        onChange={(e) => setCycleDays(parseInt(e.target.value) || 28)}
                        min="1"
                        max="365"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nextBillingDate">Next Billing Date</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="nextBillingDate"
                          type="date"
                          value={nextBillingDate}
                          onChange={(e) => setNextBillingDate(e.target.value)}
                        />
                        <Button variant="outline" onClick={calculateNextBillingDate}>
                          Auto
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="isActive">Billing system is active</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Role Pricing Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Role Pricing (per cycle)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Existing Rates */}
                  <div className="space-y-3">
                    {Object.entries(rates).map(([role, rate]) => (
                      <div key={role} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Badge variant="outline" className="min-w-[120px] justify-center">
                          {role}
                        </Badge>
                        <div className="flex-1">
                          <Input
                            type="number"
                            value={rate}
                            onChange={(e) => handleRateChange(role, e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-32"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveRole(role)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Role */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Add New Role</h4>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Role name (e.g., Supervisor)"
                        value={newRoleType}
                        onChange={(e) => setNewRoleType(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Rate"
                        value={newRoleRate}
                        onChange={(e) => setNewRoleRate(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-32"
                      />
                      <Button onClick={handleAddRole} disabled={!newRoleType.trim() || !newRoleRate.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-600">Total Roles</p>
                      <p className="text-2xl font-bold">{Object.keys(rates).length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cycle Length</p>
                      <p className="text-2xl font-bold">{cycleDays} days</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={updateConfigMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  );
}