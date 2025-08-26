import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { hasPermission } from "@/lib/permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  Save, 
  RefreshCw, 
  Shield,
  Lock,
  AlertCircle,
  Clock,
  Calendar,
  Users,
  ArrowLeft,
  Plus
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

const serviceTypeColors: Record<string, string> = {
  "Personal Care": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Community Participation": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", 
  "Domestic Assistance": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Supported Independent Living": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Sleepover": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
};

const categoryIcons: Record<string, any> = {
  "Daytime": Clock,
  "Evening": Clock,
  "Active Night": Clock,
  "Saturday": Calendar,
  "Sunday": Calendar,
  "Public Holiday": Calendar,
  "Sleepover": Users
};

export default function PricingManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [editingPrices, setEditingPrices] = useState<Record<number, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    code: "",
    category: "",
    serviceType: "",
    unit: "hour",
    price: ""
  });

  // Check permissions
  if (!user || !hasPermission(user, "ACCESS_COMPLIANCE")) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-4">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Access Restricted</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You need Admin or Coordinator permissions to manage pricing.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch line items with pricing
  const { data: lineItems, isLoading, error } = useQuery({
    queryKey: ["/api/line-items"],
    enabled: !!user,
  });

  // Update prices mutation
  const updatePricesMutation = useMutation({
    mutationFn: async (updates: { id: number; price: number }[]) => {
      return await apiRequest("/api/line-items/bulk-update", {
        method: "POST",
        body: JSON.stringify({ updates }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Prices updated successfully",
        description: "All pricing changes have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/line-items"] });
      setEditingPrices({});
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update prices",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Add new line item mutation
  const addLineItemMutation = useMutation({
    mutationFn: async (lineItem: any) => {
      return await apiRequest("/api/line-items", {
        method: "POST",
        body: JSON.stringify({
          ...lineItem,
          price: parseFloat(lineItem.price)
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Line item added successfully",
        description: "New pricing item has been created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/line-items"] });
      setShowAddDialog(false);
      setNewLineItem({
        code: "",
        category: "",
        serviceType: "",
        unit: "hour", 
        price: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add line item",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handlePriceChange = (itemId: number, newPrice: string) => {
    setEditingPrices(prev => ({
      ...prev,
      [itemId]: newPrice
    }));
    setHasChanges(true);
  };

  const saveChanges = () => {
    const updates = Object.entries(editingPrices)
      .map(([itemId, price]) => ({
        id: parseInt(itemId),
        price: parseFloat(price)
      }))
      .filter(update => !isNaN(update.price) && update.price > 0);

    if (updates.length === 0) {
      toast({
        title: "No valid changes to save",
        description: "Please enter valid prices before saving.",
        variant: "destructive",
      });
      return;
    }

    updatePricesMutation.mutate(updates);
  };

  const resetChanges = () => {
    setEditingPrices({});
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Pricing Management
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Loading pricing information...
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-4">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error Loading Pricing</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Unable to load pricing information. Please try again.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group line items by service type
  const groupedItems = (lineItems || []).reduce((acc: any, item: any) => {
    if (!acc[item.serviceType]) {
      acc[item.serviceType] = [];
    }
    acc[item.serviceType].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/compliance")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Compliance
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              NDIS Pricing Management
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Manage line item pricing for your NDIS services
            </p>
          </div>
        </div>
        
        {hasChanges && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={resetChanges}
              disabled={updatePricesMutation.isPending}
            >
              Reset Changes
            </Button>
            <Button 
              onClick={saveChanges}
              disabled={updatePricesMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="mr-2 h-4 w-4" />
              {updatePricesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
        
        {/* Add Price Button */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add Line Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Line Item</DialogTitle>
              <DialogDescription>
                Create a new NDIS line item with pricing information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Service Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., PC_DAY"
                    value={newLineItem.code}
                    onChange={(e) => setNewLineItem(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Daytime"
                    value={newLineItem.category}
                    onChange={(e) => setNewLineItem(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type</Label>
                <Select onValueChange={(value) => setNewLineItem(prev => ({ ...prev, serviceType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal Care">Personal Care</SelectItem>
                    <SelectItem value="Community Participation">Community Participation</SelectItem>
                    <SelectItem value="Domestic Assistance">Domestic Assistance</SelectItem>
                    <SelectItem value="Supported Independent Living">Supported Independent Living</SelectItem>
                    <SelectItem value="Sleepover">Sleepover</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select onValueChange={(value) => setNewLineItem(prev => ({ ...prev, unit: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Hour</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="visit">Visit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="68.50"
                    value={newLineItem.price}
                    onChange={(e) => setNewLineItem(prev => ({ ...prev, price: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => addLineItemMutation.mutate(newLineItem)}
                disabled={!newLineItem.code || !newLineItem.serviceType || !newLineItem.price || addLineItemMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addLineItemMutation.isPending ? "Adding..." : "Add Line Item"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pricing Cards by Service Type */}
      <div className="space-y-6">
        {Object.entries(groupedItems || {}).map(([serviceType, items]: [string, any]) => {
          const IconComponent = categoryIcons[items[0]?.category] || DollarSign;
          
          return (
            <Card key={serviceType}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <IconComponent className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                  <span>{serviceType}</span>
                  <Badge className={serviceTypeColors[serviceType] || "bg-slate-100 text-slate-800"}>
                    {items.length} rate{items.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Manage pricing for all {serviceType.toLowerCase()} service categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((item: any) => {
                    const currentPrice = editingPrices[item.id] !== undefined 
                      ? editingPrices[item.id] 
                      : item.price.toString();
                    
                    return (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-800"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {item.category}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {item.code} • {item.unit}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentPrice}
                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            className="w-24 text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!lineItems || lineItems.length === 0) && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <DollarSign className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                No pricing configured
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Click "Add Line Item" above to create your first NDIS pricing entry.
              </p>
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Line Item
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}