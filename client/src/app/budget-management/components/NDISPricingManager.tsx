import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, DollarSign, Settings } from "lucide-react";

const pricingFormSchema = z.object({
  shiftType: z.enum(["AM", "PM", "ActiveNight", "Sleepover"]),
  ratio: z.enum(["1:1", "1:2", "1:3", "1:4", "2:1"]),
  rate: z.number().positive("Rate must be positive"),
});

type PricingFormData = z.infer<typeof pricingFormSchema>;

interface NdisPricing {
  id: number;
  companyId: string;
  shiftType: string;
  ratio: string;
  rate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function NDISPricingManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<NdisPricing | null>(null);

  const { data: pricingData = [], isLoading } = useQuery<NdisPricing[]>({
    queryKey: ["/api/ndis-pricing"],
  });

  const form = useForm<PricingFormData>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      shiftType: "AM",
      ratio: "1:1",
      rate: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PricingFormData) => {
      const url = editingPricing ? `/api/ndis-pricing/${editingPricing.id}` : "/api/ndis-pricing";
      const method = editingPricing ? "PUT" : "POST";
      return apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ndis-pricing"] });
      toast({
        title: editingPricing ? "Pricing updated successfully" : "Pricing created successfully",
        description: "The NDIS pricing has been saved.",
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast({
        title: "Error saving pricing",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/ndis-pricing/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ndis-pricing"] });
      toast({
        title: "Pricing deleted successfully",
        description: "The NDIS pricing has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting pricing",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (pricing: NdisPricing) => {
    setEditingPricing(pricing);
    form.reset({
      shiftType: pricing.shiftType as any,
      ratio: pricing.ratio as any,
      rate: parseFloat(pricing.rate),
    });
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingPricing(null);
    form.reset();
  };

  const onSubmit = (data: PricingFormData) => {
    createMutation.mutate(data);
  };

  const getShiftTypeColor = (shiftType: string) => {
    switch (shiftType) {
      case "AM": return "bg-blue-100 text-blue-800";
      case "PM": return "bg-green-100 text-green-800";
      case "ActiveNight": return "bg-purple-100 text-purple-800";
      case "Sleepover": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getRatioColor = (ratio: string) => {
    switch (ratio) {
      case "1:1": return "bg-red-100 text-red-800";
      case "1:2": return "bg-yellow-100 text-yellow-800";
      case "1:3": return "bg-green-100 text-green-800";
      case "1:4": return "bg-blue-100 text-blue-800";
      case "2:1": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Auto-populate pricing ratios based on 1:1 rate
  const autoPopulatePricing = (baseRate: number, shiftType: string) => {
    const ratioMultipliers = {
      "1:2": 0.50, // Half price for 1 staff : 2 clients
      "1:3": 0.33, // One-third price for 1 staff : 3 clients  
      "1:4": 0.25, // Quarter price for 1 staff : 4 clients
      "2:1": 2.00  // Double price for 2 staff : 1 client
    };

    const mutations = Object.entries(ratioMultipliers).map(([ratio, multiplier]) => {
      const calculatedRate = baseRate * multiplier;
      return {
        shiftType,
        ratio,
        rate: Math.round(calculatedRate * 100) / 100 // Round to 2 decimal places
      };
    });

    // Create all ratio pricing entries
    mutations.forEach(async (pricingData) => {
      try {
        await apiRequest("POST", "/api/ndis-pricing", pricingData);
      } catch (error) {
        console.error(`Failed to create ${pricingData.ratio} pricing:`, error);
      }
    });

    // Refresh the pricing data
    queryClient.invalidateQueries({ queryKey: ["/api/ndis-pricing"] });
    
    toast({
      title: "Auto-populated pricing ratios",
      description: `Created pricing for all ratios based on 1:1 rate of $${baseRate}`,
    });
  };

  // Group pricing data by shift type and ratio for better organization
  const organizedPricing = pricingData.reduce((acc, pricing) => {
    const key = `${pricing.shiftType}-${pricing.ratio}`;
    acc[key] = pricing;
    return acc;
  }, {} as Record<string, NdisPricing>);

  const shiftTypes = ["AM", "PM", "ActiveNight", "Sleepover"];
  const ratios = ["1:1", "1:2", "1:3", "1:4", "2:1"];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>NDIS Pricing Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              NDIS Pricing Management
            </CardTitle>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pricing
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingPricing ? "Edit NDIS Pricing" : "Create NDIS Pricing"}
                  </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="shiftType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shift Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select shift type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="AM">AM (6:00 - 20:00)</SelectItem>
                              <SelectItem value="PM">PM (20:00 - 00:00)</SelectItem>
                              <SelectItem value="ActiveNight">Active Night (00:00 - 06:00)</SelectItem>
                              <SelectItem value="Sleepover">Sleepover</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ratio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Staff to Client Ratio</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select ratio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1:1">1:1 (One-on-One)</SelectItem>
                              <SelectItem value="1:2">1:2 (One to Two)</SelectItem>
                              <SelectItem value="1:3">1:3 (One to Three)</SelectItem>
                              <SelectItem value="1:4">1:4 (One to Four)</SelectItem>
                              <SelectItem value="2:1">2:1 (Two to One)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Auto-populate section - only show for 1:1 ratio */}
                    {form.watch("ratio") === "1:1" && form.watch("rate") > 0 && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-900 mb-2">Auto-populate Other Ratios</h4>
                        <p className="text-sm text-blue-700 mb-3">
                          Create pricing for all ratios based on your 1:1 rate of ${form.watch("rate")}:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-blue-600 mb-3">
                          <div>1:2 = ${(form.watch("rate") * 0.50).toFixed(2)}</div>
                          <div>1:3 = ${(form.watch("rate") * 0.33).toFixed(2)}</div>
                          <div>1:4 = ${(form.watch("rate") * 0.25).toFixed(2)}</div>
                          <div>2:1 = ${(form.watch("rate") * 2.00).toFixed(2)}</div>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => autoPopulatePricing(form.watch("rate"), form.watch("shiftType"))}
                          className="w-full"
                        >
                          Auto-populate All Ratios
                        </Button>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={handleCloseModal}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending
                          ? (editingPricing ? "Updating..." : "Creating...")
                          : (editingPricing ? "Update Pricing" : "Create Pricing")
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {pricingData.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pricing configured</h3>
              <p className="text-gray-500 mb-4">Set up NDIS pricing rates for different shift types and staff ratios.</p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Pricing
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pricing Matrix */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shift Type</TableHead>
                      {ratios.map((ratio) => (
                        <TableHead key={ratio} className="text-center">
                          <Badge className={getRatioColor(ratio)}>{ratio}</Badge>
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftTypes.map((shiftType) => (
                      <TableRow key={shiftType}>
                        <TableCell>
                          <Badge className={getShiftTypeColor(shiftType)}>
                            {shiftType}
                          </Badge>
                        </TableCell>
                        {ratios.map((ratio) => {
                          const pricing = organizedPricing[`${shiftType}-${ratio}`];
                          return (
                            <TableCell key={ratio} className="text-center">
                              {pricing ? (
                                <div className="font-medium">
                                  ${parseFloat(pricing.rate).toFixed(2)}
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {ratios.some(ratio => organizedPricing[`${shiftType}-${ratio}`]) && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const firstPricing = ratios
                                      .map(ratio => organizedPricing[`${shiftType}-${ratio}`])
                                      .find(p => p);
                                    if (firstPricing) handleEdit(firstPricing);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const firstPricing = ratios
                                      .map(ratio => organizedPricing[`${shiftType}-${ratio}`])
                                      .find(p => p);
                                    if (firstPricing) deleteMutation.mutate(firstPricing.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Individual Pricing Items */}
              <div className="space-y-2">
                <h4 className="font-medium">All Pricing Rules</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pricingData.map((pricing) => (
                    <Card key={pricing.id} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="space-y-1">
                            <Badge className={getShiftTypeColor(pricing.shiftType)}>
                              {pricing.shiftType}
                            </Badge>
                            <Badge className={getRatioColor(pricing.ratio)}>
                              {pricing.ratio}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(pricing)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(pricing.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xl font-bold text-green-600">
                          ${parseFloat(pricing.rate).toFixed(2)}/hr
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Updated: {new Date(pricing.updatedAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}