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
import { calculateRatioMultiplier } from "@shared/utils/ratioCalculator";
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
    hoursDay: "0",
    unitDay: "0",
    hoursWeekdayEvening: "0",
    unitWeekdayEvening: "0",
    hoursActiveNight: "0",
    unitActiveNight: "0",
    hoursSleepover: "0",
    unitSleepover: "0",
    hoursSaturday: "0",
    unitSaturday: "0",
    hoursSunday: "0",
    unitSunday: "0",
    hoursPublicHoliday: "0",
    unitPublicHoliday: "0",
    ratioOfSupport: "1:1",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      ndisCode: "",
      supportDescription: "",
      weeks: 1,
      hoursDay: "0",
      unitDay: "0",
      hoursWeekdayEvening: "0",
      unitWeekdayEvening: "0",
      hoursActiveNight: "0",
      unitActiveNight: "0",
      hoursSleepover: "0",
      unitSleepover: "0",
      hoursSaturday: "0",
      unitSaturday: "0",
      hoursSunday: "0",
      unitSunday: "0",
      hoursPublicHoliday: "0",
      unitPublicHoliday: "0",
      ratioOfSupport: "1:1",
      notes: "",
    });
  };

  const calculateItemTotal = (item: Partial<ServiceAgreementItem>) => {
    // Use the ratio calculator utility for consistent calculation
    const ratioMultiplier = calculateRatioMultiplier(item.ratioOfSupport || "1:1");
    
    // Convert string values to numbers for calculations
    const toNumber = (value: string | number | undefined) => {
      if (typeof value === 'string') return parseFloat(value) || 0;
      return value || 0;
    };
    
    const dayAmount = toNumber(item.hoursDay) * toNumber(item.unitDay) * ratioMultiplier;
    const weekdayEveningAmount = toNumber(item.hoursWeekdayEvening) * toNumber(item.unitWeekdayEvening) * ratioMultiplier;
    const activeNightAmount = toNumber(item.hoursActiveNight) * toNumber(item.unitActiveNight) * ratioMultiplier;
    const sleeperAmount = toNumber(item.hoursSleepover) * toNumber(item.unitSleepover) * ratioMultiplier;
    const saturdayAmount = toNumber(item.hoursSaturday) * toNumber(item.unitSaturday) * ratioMultiplier;
    const sundayAmount = toNumber(item.hoursSunday) * toNumber(item.unitSunday) * ratioMultiplier;
    const holidayAmount = toNumber(item.hoursPublicHoliday) * toNumber(item.unitPublicHoliday) * ratioMultiplier;
    
    const weeklyTotal = dayAmount + weekdayEveningAmount + activeNightAmount + sleeperAmount + 
                      saturdayAmount + sundayAmount + holidayAmount;
    
    return weeklyTotal * (item.weeks || 1);
  };

  const handleAddItem = () => {
    // Convert string values to numbers for storage
    const processedFormData = {
      ...formData,
      hoursDay: toNumber(formData.hoursDay),
      unitDay: toNumber(formData.unitDay),
      hoursWeekdayEvening: toNumber(formData.hoursWeekdayEvening),
      unitWeekdayEvening: toNumber(formData.unitWeekdayEvening),
      hoursActiveNight: toNumber(formData.hoursActiveNight),
      unitActiveNight: toNumber(formData.unitActiveNight),
      hoursSleepover: toNumber(formData.hoursSleepover),
      unitSleepover: toNumber(formData.unitSleepover),
      hoursSaturday: toNumber(formData.hoursSaturday),
      unitSaturday: toNumber(formData.unitSaturday),
      hoursSunday: toNumber(formData.hoursSunday),
      unitSunday: toNumber(formData.unitSunday),
      hoursPublicHoliday: toNumber(formData.hoursPublicHoliday),
      unitPublicHoliday: toNumber(formData.unitPublicHoliday),
    };

    const newItem: ServiceAgreementItem = {
      id: Date.now(), // Temporary ID for new items
      ...processedFormData as ServiceAgreementItem,
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

      {/* Ratio of Support */}
      <div className="space-y-2">
        <Label htmlFor="ratioOfSupport">Ratio of Support</Label>
        <select
          id="ratioOfSupport"
          value={formData.ratioOfSupport || "1:1"}
          onChange={(e) => handleFieldChange("ratioOfSupport", e.target.value)}
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
        >
          <option value="1:1">1:1 (Standard - full price)</option>
          <option value="1:2">1:2 (Half price - two participants)</option>
          <option value="1:3">1:3 (One third price - three participants)</option>
          <option value="1:4">1:4 (One quarter price - four participants)</option>
          <option value="2:1">2:1 (Double price - two workers per participant)</option>
        </select>
        <p className="text-xs text-slate-500">
          Ratio determines price: 1:1 = full price, 1:2 = half price, 2:1 = double price
        </p>
      </div>

      {/* Hours and Rates Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Hours & Rates (with Ratio Applied)
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
                    value={formData.hoursDay || "0"}
                    onChange={(e) => handleFieldChange("hoursDay", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitDay || "0"}
                    onChange={(e) => handleFieldChange("unitDay", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport || "1:1");
                      return formatCurrency(toNumber(formData.hoursDay) * toNumber(formData.unitDay) * ratioMultiplier);
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekday Evening Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Weekday Evening Rate (Mon-Fri 8pm-10pm)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursWeekdayEvening || "0"}
                    onChange={(e) => handleFieldChange("hoursWeekdayEvening", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitWeekdayEvening || "0"}
                    onChange={(e) => handleFieldChange("unitWeekdayEvening", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport || "1:1");
                      return formatCurrency(toNumber(formData.hoursWeekdayEvening) * toNumber(formData.unitWeekdayEvening) * ratioMultiplier);
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Night Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Active Night Rate (10pm-6am)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursActiveNight || "0"}
                    onChange={(e) => handleFieldChange("hoursActiveNight", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitActiveNight || "0"}
                    onChange={(e) => handleFieldChange("unitActiveNight", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport || "1:1");
                      return formatCurrency(toNumber(formData.hoursActiveNight) * toNumber(formData.unitActiveNight) * ratioMultiplier);
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sleepover Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Sleepover Rate (Overnight support)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursSleepover || "0"}
                    onChange={(e) => handleFieldChange("hoursSleepover", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitSleepover || "0"}
                    onChange={(e) => handleFieldChange("unitSleepover", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport || "1:1");
                      return formatCurrency(toNumber(formData.hoursSleepover) * toNumber(formData.unitSleepover) * ratioMultiplier);
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Standard Saturday Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Standard Saturday Rate (Standard pricing, not evening)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursSaturday || "0"}
                    onChange={(e) => handleFieldChange("hoursSaturday", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitSaturday || "0"}
                    onChange={(e) => handleFieldChange("unitSaturday", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport || "1:1");
                      return formatCurrency(toNumber(formData.hoursSaturday) * toNumber(formData.unitSaturday) * ratioMultiplier);
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Standard Sunday Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Standard Sunday Rate
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursSunday || "0"}
                    onChange={(e) => handleFieldChange("hoursSunday", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitSunday || "0"}
                    onChange={(e) => handleFieldChange("unitSunday", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport || "1:1");
                      return formatCurrency(toNumber(formData.hoursSunday) * toNumber(formData.unitSunday) * ratioMultiplier);
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Standard Public Holiday Rate */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400 mb-3">
                Standard Public Holiday Rate
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours per Week</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={formData.hoursPublicHoliday || "0"}
                    onChange={(e) => handleFieldChange("hoursPublicHoliday", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitPublicHoliday || "0"}
                    onChange={(e) => handleFieldChange("unitPublicHoliday", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport || "1:1");
                      return formatCurrency(toNumber(formData.hoursPublicHoliday) * toNumber(formData.unitPublicHoliday) * ratioMultiplier);
                    })()}
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
                const totalHours = (item.hoursDay || 0) + (item.hoursWeekdayEvening || 0) + 
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