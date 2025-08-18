import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Calculator, DollarSign } from "lucide-react";
import { formatCurrency } from "@shared/utils/calc";
import { calculateRatioMultiplier } from "@shared/utils/ratioCalculator";
import type { ServiceAgreementItem } from "@shared/schema";

interface ItemsGridProps {
  items: ServiceAgreementItem[];
  onItemsChange: (items: ServiceAgreementItem[]) => void;
}

interface FormData {
  ndisCode: string;
  supportDescription: string;
  weeks: number;
  hoursDay: string;
  unitDay: string;
  hoursWeekdayEvening: string;
  unitWeekdayEvening: string;
  hoursActiveNight: string;
  unitActiveNight: string;
  hoursSleepover: string;
  unitSleepover: string;
  hoursSaturday: string;
  unitSaturday: string;
  hoursSunday: string;
  unitSunday: string;
  hoursPublicHoliday: string;
  unitPublicHoliday: string;
  ratioOfSupport: string;
  notes: string;
}

const DEFAULT_FORM_DATA: FormData = {
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
};

export default function ItemsGrid({ items, onItemsChange }: ItemsGridProps) {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceAgreementItem | null>(null);

  // Stable input handlers using useCallback
  const createFieldHandler = useCallback((field: keyof FormData) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = field === 'weeks' ? parseInt(e.target.value) || 1 : e.target.value;
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    };
  }, []);

  // Memoize all handlers to prevent re-creation
  const handlers = useMemo(() => ({
    ndisCode: createFieldHandler('ndisCode'),
    supportDescription: createFieldHandler('supportDescription'),
    weeks: createFieldHandler('weeks'),
    hoursDay: createFieldHandler('hoursDay'),
    unitDay: createFieldHandler('unitDay'),
    hoursWeekdayEvening: createFieldHandler('hoursWeekdayEvening'),
    unitWeekdayEvening: createFieldHandler('unitWeekdayEvening'),
    hoursActiveNight: createFieldHandler('hoursActiveNight'),
    unitActiveNight: createFieldHandler('unitActiveNight'),
    hoursSleepover: createFieldHandler('hoursSleepover'),
    unitSleepover: createFieldHandler('unitSleepover'),
    hoursSaturday: createFieldHandler('hoursSaturday'),
    unitSaturday: createFieldHandler('unitSaturday'),
    hoursSunday: createFieldHandler('hoursSunday'),
    unitSunday: createFieldHandler('unitSunday'),
    hoursPublicHoliday: createFieldHandler('hoursPublicHoliday'),
    unitPublicHoliday: createFieldHandler('unitPublicHoliday'),
    ratioOfSupport: createFieldHandler('ratioOfSupport'),
    notes: createFieldHandler('notes'),
  }), [createFieldHandler]);

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
  }, []);

  const calculateItemTotal = useCallback((item: Partial<FormData | ServiceAgreementItem>) => {
    const ratioMultiplier = calculateRatioMultiplier(item.ratioOfSupport || "1:1");
    const toNumber = (value: string | number | null | undefined): number => {
      if (typeof value === 'string') return parseFloat(value) || 0;
      return Number(value) || 0;
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
  }, []);

  const handleAddItem = useCallback(() => {
    const newItem: ServiceAgreementItem = {
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
      agreementId: "",
      priceListId: null,
      ndisCode: formData.ndisCode,
      supportDescription: formData.supportDescription,
      weeks: formData.weeks,
      ratioOfSupport: formData.ratioOfSupport,
      notes: formData.notes || null,
      hoursDay: formData.hoursDay,
      unitDay: formData.unitDay,
      hoursWeekdayEvening: formData.hoursWeekdayEvening,
      unitWeekdayEvening: formData.unitWeekdayEvening,
      hoursActiveNight: formData.hoursActiveNight,
      unitActiveNight: formData.unitActiveNight,
      hoursSleepover: formData.hoursSleepover,
      unitSleepover: formData.unitSleepover,
      hoursSaturday: formData.hoursSaturday,
      unitSaturday: formData.unitSaturday,
      hoursSunday: formData.hoursSunday,
      unitSunday: formData.unitSunday,
      hoursPublicHoliday: formData.hoursPublicHoliday,
      unitPublicHoliday: formData.unitPublicHoliday,
    };
    
    onItemsChange([...items, newItem]);
    resetForm();
    setIsAddingItem(false);
  }, [formData, items, onItemsChange, resetForm]);

  const handleDeleteItem = useCallback((itemId: string | number) => {
    onItemsChange(items.filter(item => item.id !== itemId.toString()));
  }, [items, onItemsChange]);

  const ServiceItemForm = useMemo(() => (
    <div className="space-y-6">
      {/* Basic Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ndisCode">NDIS Support Code</Label>
          <Input
            id="ndisCode"
            value={formData.ndisCode}
            onChange={handlers.ndisCode}
            placeholder="e.g., 01_001_0103_1_1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weeks">Number of Weeks</Label>
          <Input
            id="weeks"
            type="number"
            min="1"
            value={formData.weeks}
            onChange={handlers.weeks}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supportDescription">Support Description</Label>
        <Textarea
          id="supportDescription"
          value={formData.supportDescription}
          onChange={handlers.supportDescription}
          placeholder="Describe the support being provided..."
          className="min-h-[80px]"
        />
      </div>

      {/* Ratio of Support */}
      <div className="space-y-2">
        <Label htmlFor="ratioOfSupport">Ratio of Support</Label>
        <select
          id="ratioOfSupport"
          value={formData.ratioOfSupport}
          onChange={handlers.ratioOfSupport}
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
                    value={formData.hoursDay}
                    onChange={handlers.hoursDay}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitDay}
                    onChange={handlers.unitDay}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport);
                      const hours = parseFloat(formData.hoursDay) || 0;
                      const rate = parseFloat(formData.unitDay) || 0;
                      return formatCurrency(hours * rate * ratioMultiplier);
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
                    value={formData.hoursWeekdayEvening}
                    onChange={handlers.hoursWeekdayEvening}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitWeekdayEvening}
                    onChange={handlers.unitWeekdayEvening}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Amount</Label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-md text-sm font-medium">
                    {(() => {
                      const ratioMultiplier = calculateRatioMultiplier(formData.ratioOfSupport);
                      const hours = parseFloat(formData.hoursWeekdayEvening) || 0;
                      const rate = parseFloat(formData.unitWeekdayEvening) || 0;
                      return formatCurrency(hours * rate * ratioMultiplier);
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
            For {formData.weeks} week{formData.weeks !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={handlers.notes}
          placeholder="Any additional notes about this service item..."
        />
      </div>
    </div>
  ), [formData, handlers, calculateItemTotal]);

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
            {ServiceItemForm}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingItem(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem}>
                Add Service Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Items List */}
      {items.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NDIS Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Weeks</TableHead>
                <TableHead>Ratio</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.ndisCode}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.supportDescription}</div>
                      {item.notes && (
                        <div className="text-sm text-slate-500 mt-1">{item.notes}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.weeks}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.ratioOfSupport}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(calculateItemTotal(item))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No service items added yet</p>
          <p className="text-sm">Click "Add Service Item" to get started</p>
        </div>
      )}

      {/* Total Summary */}
      {items.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Agreement Value:</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(items.reduce((total, item) => total + calculateItemTotal(item), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}