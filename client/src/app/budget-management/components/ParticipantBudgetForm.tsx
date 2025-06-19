import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const budgetFormSchema = z.object({
  clientId: z.number().positive("Client is required"),
  silTotal: z.number().min(0, "SIL total must be non-negative"),
  silRemaining: z.number().min(0, "SIL remaining must be non-negative"),
  silAllowedRatios: z.array(z.enum(["1:1", "1:2", "1:3", "1:4", "2:1"])).min(1, "At least one SIL ratio required"),
  communityAccessTotal: z.number().min(0, "Community Access total must be non-negative"),
  communityAccessRemaining: z.number().min(0, "Community Access remaining must be non-negative"),
  communityAccessAllowedRatios: z.array(z.enum(["1:1", "1:2", "1:3", "1:4", "2:1"])).min(1, "At least one Community Access ratio required"),
  capacityBuildingTotal: z.number().min(0, "Capacity Building total must be non-negative"),
  capacityBuildingRemaining: z.number().min(0, "Capacity Building remaining must be non-negative"),
  capacityBuildingAllowedRatios: z.array(z.enum(["1:1", "1:2", "1:3", "1:4", "2:1"])).min(1, "At least one Capacity Building ratio required"),
  priceOverrides: z.object({
    AM: z.number().positive().optional(),
    PM: z.number().positive().optional(),
    ActiveNight: z.number().positive().optional(),
    Sleepover: z.number().positive().optional(),
  }).optional(),
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

interface ParticipantBudgetFormProps {
  budget?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const ratioOptions = ["1:1", "1:2", "1:3", "1:4", "2:1"];

export default function ParticipantBudgetForm({ budget, onClose, onSuccess }: ParticipantBudgetFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPriceOverrides, setShowPriceOverrides] = useState(false);
  
  console.log("ParticipantBudgetForm rendering", { budget, showPriceOverrides });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      clientId: budget?.clientId || 0,
      silTotal: parseFloat(budget?.silTotal || "0"),
      silRemaining: parseFloat(budget?.silRemaining || "0"),
      silAllowedRatios: budget?.silAllowedRatios || ["1:1"],
      communityAccessTotal: parseFloat(budget?.communityAccessTotal || "0"),
      communityAccessRemaining: parseFloat(budget?.communityAccessRemaining || "0"),
      communityAccessAllowedRatios: budget?.communityAccessAllowedRatios || ["1:1"],
      capacityBuildingTotal: parseFloat(budget?.capacityBuildingTotal || "0"),
      capacityBuildingRemaining: parseFloat(budget?.capacityBuildingRemaining || "0"),
      capacityBuildingAllowedRatios: budget?.capacityBuildingAllowedRatios || ["1:1"],
      priceOverrides: budget?.priceOverrides || {},
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BudgetFormData) => {
      const url = budget ? `/api/ndis-budgets/${budget.id}` : "/api/ndis-budgets";
      const method = budget ? "PUT" : "POST";
      return apiRequest(url, method, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ndis-budgets"] });
      toast({
        title: budget ? "Budget updated successfully" : "Budget created successfully",
        description: "The NDIS budget has been saved.",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error saving budget",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BudgetFormData) => {
    // Auto-set remaining amounts to total if creating new budget
    if (!budget) {
      data.silRemaining = data.silTotal;
      data.communityAccessRemaining = data.communityAccessTotal;
      data.capacityBuildingRemaining = data.capacityBuildingTotal;
    }
    
    createMutation.mutate(data);
  };

  const handleRatioChange = (category: string, ratio: string, checked: boolean) => {
    const currentRatios = form.getValues(`${category}AllowedRatios` as any) || [];
    
    if (checked) {
      const newRatios = [...currentRatios, ratio];
      form.setValue(`${category}AllowedRatios` as any, newRatios);
    } else {
      const newRatios = currentRatios.filter((r: string) => r !== ratio);
      form.setValue(`${category}AllowedRatios` as any, newRatios);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {budget ? "Edit NDIS Budget" : "Create NDIS Budget"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Client Selection */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Participant</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                    disabled={!!budget}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select participant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.firstName} {client.lastName} ({client.clientId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SIL Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">SIL (Supported Independent Living)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="silTotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Budget ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {budget && (
                    <FormField
                      control={form.control}
                      name="silRemaining"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Remaining ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div>
                    <FormLabel>Allowed Staff Ratios</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ratioOptions.map((ratio) => (
                        <div key={ratio} className="flex items-center space-x-2">
                          <Checkbox
                            id={`sil-${ratio}`}
                            checked={(form.watch("silAllowedRatios") || []).includes(ratio)}
                            onCheckedChange={(checked) => handleRatioChange("sil", ratio, checked as boolean)}
                          />
                          <label htmlFor={`sil-${ratio}`} className="text-sm font-medium">
                            {ratio}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Community Access Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Community Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="communityAccessTotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Budget ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {budget && (
                    <FormField
                      control={form.control}
                      name="communityAccessRemaining"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Remaining ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div>
                    <FormLabel>Allowed Staff Ratios</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ratioOptions.map((ratio) => (
                        <div key={ratio} className="flex items-center space-x-2">
                          <Checkbox
                            id={`community-${ratio}`}
                            checked={(form.watch("communityAccessAllowedRatios") || []).includes(ratio)}
                            onCheckedChange={(checked) => handleRatioChange("communityAccess", ratio, checked as boolean)}
                          />
                          <label htmlFor={`community-${ratio}`} className="text-sm font-medium">
                            {ratio}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Capacity Building Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Capacity Building</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="capacityBuildingTotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Budget ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {budget && (
                    <FormField
                      control={form.control}
                      name="capacityBuildingRemaining"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Remaining ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div>
                    <FormLabel>Allowed Staff Ratios</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ratioOptions.map((ratio) => (
                        <div key={ratio} className="flex items-center space-x-2">
                          <Checkbox
                            id={`capacity-${ratio}`}
                            checked={(form.watch("capacityBuildingAllowedRatios") || []).includes(ratio)}
                            onCheckedChange={(checked) => handleRatioChange("capacityBuilding", ratio, checked as boolean)}
                          />
                          <label htmlFor={`capacity-${ratio}`} className="text-sm font-medium">
                            {ratio}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Price Overrides (Optional) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Price Overrides (Optional)</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPriceOverrides(!showPriceOverrides)}
                  >
                    {showPriceOverrides ? "Hide" : "Show"} Overrides
                  </Button>
                </CardTitle>
              </CardHeader>
              {showPriceOverrides && (
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="priceOverrides.AM"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AM Shift Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Use default"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priceOverrides.PM"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PM Shift Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Use default"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priceOverrides.ActiveNight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Active Night Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Use default"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priceOverrides.Sleepover"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sleepover Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Use default"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? (budget ? "Updating..." : "Creating...")
                  : (budget ? "Update Budget" : "Create Budget")
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}