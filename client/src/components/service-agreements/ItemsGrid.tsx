import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2, Calculator } from "lucide-react";
import { formatCurrency } from "@shared/utils/calc";
import type { ServiceAgreementItem } from "@shared/schema";

interface ItemsGridProps {
  items: ServiceAgreementItem[];
  onItemsChange: (items: ServiceAgreementItem[]) => void;
}

export default function ItemsGrid({ items, onItemsChange }: ItemsGridProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceAgreementItem | null>(null);
  const [formData, setFormData] = useState<Partial<ServiceAgreementItem>>({
    ndisCode: "",
    supportDescription: "",
    weeks: 1,
    hoursDay: 0,
    unitDay: 0,
    hoursEvening: 0,
    unitEvening: 0,
    hoursActiveNight: 0,
    unitActiveNight: 0,
    hoursSleepover: 0,
    unitSleepover: 0,
    hoursSaturday: 0,
    unitSaturday: 0,
    hoursSunday: 0,
    unitSunday: 0,
    hoursPublicHoliday: 0,
    unitPublicHoliday: 0,
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      ndisCode: "",
      supportDescription: "",
      weeks: 1,
      hoursDay: 0,
      unitDay: 0,
      hoursEvening: 0,
      unitEvening: 0,
      hoursActiveNight: 0,
      unitActiveNight: 0,
      hoursSleepover: 0,
      unitSleepover: 0,
      hoursSaturday: 0,
      unitSaturday: 0,
      hoursSunday: 0,
      unitSunday: 0,
      hoursPublicHoliday: 0,
      unitPublicHoliday: 0,
      notes: "",
    });
  };

  const calculateItemTotal = (item: Partial<ServiceAgreementItem>) => {
    const dayAmount = (item.hoursDay || 0) * (item.unitDay || 0);
    const eveningAmount = (item.hoursEvening || 0) * (item.unitEvening || 0);
    const activeNightAmount = (item.hoursActiveNight || 0) * (item.unitActiveNight || 0);
    const sleeperAmount = (item.hoursSleepover || 0) * (item.unitSleepover || 0);
    const saturdayAmount = (item.hoursSaturday || 0) * (item.unitSaturday || 0);
    const sundayAmount = (item.hoursSunday || 0) * (item.unitSunday || 0);
    const holidayAmount = (item.hoursPublicHoliday || 0) * (item.unitPublicHoliday || 0);
    
    const weeklyTotal = dayAmount + eveningAmount + activeNightAmount + sleeperAmount + 
                      saturdayAmount + sundayAmount + holidayAmount;
    
    return weeklyTotal * (item.weeks || 1);
  };

  const handleAddItem = () => {
    const newItem: ServiceAgreementItem = {
      id: Date.now(), // Temporary ID for new items
      ...formData as ServiceAgreementItem,
    };
    
    onItemsChange([...items, newItem]);
    resetForm();
    setIsAddingItem(false);
  };

  const handleEditItem = (item: ServiceAgreementItem) => {
    setEditingItem(item);
    setFormData(item);
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    
    const updatedItems = items.map(item => 
      item.id === editingItem.id 
        ? { ...item, ...formData }
        : item
    );
    
    onItemsChange(updatedItems);
    setEditingItem(null);
    resetForm();
  };

  const handleDeleteItem = (itemId: number) => {
    onItemsChange(items.filter(item => item.id !== itemId));
  };

  const handleFieldChange = (field: keyof ServiceAgreementItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const ItemForm = () => (
    <div className="space-y-6">
      {/* Basic Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ndisCode">NDIS Support Code</Label>
          <Input
            id="ndisCode"
            value={formData.ndisCode || ""}
            onChange={(e) => handleFieldChange("ndisCode", e.target.value)}
            placeholder="e.g., 01_001_0103_1_1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weeks">Duration (Weeks)</Label>
          <Input
            id="weeks"
            type="number"
            min="1"
            value={formData.weeks || 1}
            onChange={(e) => handleFieldChange("weeks", parseInt(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supportDescription">Support Description</Label>
        <Textarea
          id="supportDescription"
          value={formData.supportDescription || ""}
          onChange={(e) => handleFieldChange("supportDescription", e.target.value)}
          placeholder="Describe the support being provided..."
          className="min-h-[80px]"
        />
      </div>

      {/* Hours and Rates Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Hours & Rates
        </h3>
        
        <div className="grid gap-4">
          {/* Day Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Standard Day Rate (Mon-Fri 6am-8pm)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursDay || 0}
                    onChange={(e) => handleFieldChange("hoursDay", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitDay || 0}
                    onChange={(e) => handleFieldChange("unitDay", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {formatCurrency((formData.hoursDay || 0) * (formData.unitDay || 0))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evening Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Evening Rate (Mon-Fri 8pm-10pm, Sat 6pm-10pm)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursEvening || 0}
                    onChange={(e) => handleFieldChange("hoursEvening", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitEvening || 0}
                    onChange={(e) => handleFieldChange("unitEvening", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {formatCurrency((formData.hoursEvening || 0) * (formData.unitEvening || 0))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional rates in similar cards... */}
          {/* Active Night, Sleepover, Saturday, Sunday, Public Holiday */}
          
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Weekend & Holiday Rates
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Saturday Hours</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={formData.hoursSaturday || 0}
                        onChange={(e) => handleFieldChange("hoursSaturday", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Saturday Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.unitSaturday || 0}
                        onChange={(e) => handleFieldChange("unitSaturday", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Sunday Hours</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={formData.hoursSunday || 0}
                        onChange={(e) => handleFieldChange("hoursSunday", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sunday Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.unitSunday || 0}
                        onChange={(e) => handleFieldChange("unitSunday", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Holiday Hours</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={formData.hoursPublicHoliday || 0}
                        onChange={(e) => handleFieldChange("hoursPublicHoliday", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Holiday Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.unitPublicHoliday || 0}
                        onChange={(e) => handleFieldChange("unitPublicHoliday", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Total */}
        <div className="text-right">
          <div className="text-lg font-semibold">
            Line Total: {formatCurrency(calculateItemTotal(formData))}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            For {formData.weeks || 1} week{(formData.weeks || 1) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => handleFieldChange("notes", e.target.value)}
          placeholder="Any additional notes about this service item..."
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Service Line Items</h3>
        <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsAddingItem(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Service Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Service Item</DialogTitle>
              <DialogDescription>
                Configure support hours, rates, and pricing for this service item
              </DialogDescription>
            </DialogHeader>
            <ItemForm />
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsAddingItem(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem}>
                Add Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NDIS Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Weeks</TableHead>
                <TableHead className="text-center">Total Hours</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const totalHours = (item.hoursDay || 0) + (item.hoursEvening || 0) + 
                                 (item.hoursActiveNight || 0) + (item.hoursSleepover || 0) + 
                                 (item.hoursSaturday || 0) + (item.hoursSunday || 0) + 
                                 (item.hoursPublicHoliday || 0);
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.ndisCode}</TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="truncate">{item.supportDescription}</p>
                        {item.notes && (
                          <p className="text-xs text-slate-500 truncate mt-1">{item.notes}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.weeks}</TableCell>
                    <TableCell className="text-center">{totalHours}h/week</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(calculateItemTotal(item))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditItem(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
          <Calculator className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            No service items added
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Add support items with hours and pricing to build the agreement
          </p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service Item</DialogTitle>
            <DialogDescription>
              Update support hours, rates, and pricing for this service item
            </DialogDescription>
          </DialogHeader>
          <ItemForm />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateItem}>
              Update Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}