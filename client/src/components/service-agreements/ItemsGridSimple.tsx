import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Sun, Moon, Bed, Calendar, Gift, Clock } from "lucide-react";
import { formatCurrency } from "@shared/utils/calc";
import type { ServiceAgreementItem } from "@shared/schema";
import ServiceItemSelector from "./ServiceItemSelector";

interface ItemsGridProps {
  items: ServiceAgreementItem[];
  onItemsChange: (items: ServiceAgreementItem[]) => void;
}

const SERVICE_TYPE_ICONS = {
  day: Sun,
  evening: Clock,
  activeNight: Moon,
  sleepover: Bed,
  saturday: Calendar,
  sunday: Calendar,
  publicHoliday: Gift,
};

const SERVICE_TYPE_LABELS = {
  day: "Standard Day",
  evening: "Evening",
  activeNight: "Active Night",
  sleepover: "Sleepover",
  saturday: "Saturday",
  sunday: "Sunday",
  publicHoliday: "Public Holiday",
};

const SERVICE_TYPE_COLORS = {
  day: "bg-yellow-100 text-yellow-800",
  evening: "bg-blue-100 text-blue-800",
  activeNight: "bg-purple-100 text-purple-800",
  sleepover: "bg-indigo-100 text-indigo-800",
  saturday: "bg-green-100 text-green-800",
  sunday: "bg-red-100 text-red-800",
  publicHoliday: "bg-orange-100 text-orange-800",
};

export default function ItemsGridSimple({ items, onItemsChange }: ItemsGridProps) {
  const [showSelector, setShowSelector] = useState(false);

  const handleAddItem = (newItem: any) => {
    // Generate a temporary ID for new items
    const itemWithId = {
      ...newItem,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    onItemsChange([...items, itemWithId]);
  };

  const handleDeleteItem = (itemId: string) => {
    onItemsChange(items.filter(item => item.id !== itemId));
  };

  const getServiceTypeFromItem = (item: ServiceAgreementItem): string => {
    // Determine which service type has hours > 0
    if (Number(item.hoursDay) > 0) return 'day';
    if (Number(item.hoursEvening) > 0) return 'evening';
    if (Number(item.hoursActiveNight) > 0) return 'activeNight';
    if (Number(item.hoursSleepover) > 0) return 'sleepover';
    if (Number(item.hoursSaturday) > 0) return 'saturday';
    if (Number(item.hoursSunday) > 0) return 'sunday';
    if (Number(item.hoursPublicHoliday) > 0) return 'publicHoliday';
    return 'day'; // fallback
  };

  const getItemHours = (item: ServiceAgreementItem): number => {
    if (Number(item.hoursDay) > 0) return Number(item.hoursDay);
    if (Number(item.hoursEvening) > 0) return Number(item.hoursEvening);
    if (Number(item.hoursActiveNight) > 0) return Number(item.hoursActiveNight);
    if (Number(item.hoursSleepover) > 0) return Number(item.hoursSleepover);
    if (Number(item.hoursSaturday) > 0) return Number(item.hoursSaturday);
    if (Number(item.hoursSunday) > 0) return Number(item.hoursSunday);
    if (Number(item.hoursPublicHoliday) > 0) return Number(item.hoursPublicHoliday);
    return 0;
  };

  const getItemUnitRate = (item: ServiceAgreementItem): number => {
    if (Number(item.hoursDay) > 0) return Number(item.unitDay);
    if (Number(item.hoursEvening) > 0) return Number(item.unitEvening);
    if (Number(item.hoursActiveNight) > 0) return Number(item.unitActiveNight);
    if (Number(item.hoursSleepover) > 0) return Number(item.unitSleepover);
    if (Number(item.hoursSaturday) > 0) return Number(item.unitSaturday);
    if (Number(item.hoursSunday) > 0) return Number(item.unitSunday);
    if (Number(item.hoursPublicHoliday) > 0) return Number(item.unitPublicHoliday);
    return 0;
  };

  const calculateItemTotal = (item: ServiceAgreementItem): number => {
    const hours = getItemHours(item);
    const rate = getItemUnitRate(item);
    return hours * rate * item.weeks;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Service Items</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Add individual service types with specific hours and rates
            </p>
          </div>
          <Button onClick={() => setShowSelector(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No service items added yet.</p>
            <p className="text-sm mt-1">Click "Add Service Item" to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Type</TableHead>
                <TableHead>NDIS Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Hours/Week</TableHead>
                <TableHead className="text-right">Unit Rate</TableHead>
                <TableHead className="text-right">Weeks</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const serviceType = getServiceTypeFromItem(item);
                const Icon = SERVICE_TYPE_ICONS[serviceType as keyof typeof SERVICE_TYPE_ICONS];
                const label = SERVICE_TYPE_LABELS[serviceType as keyof typeof SERVICE_TYPE_LABELS];
                const colorClass = SERVICE_TYPE_COLORS[serviceType as keyof typeof SERVICE_TYPE_COLORS];
                const total = calculateItemTotal(item);

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-md ${colorClass}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <Badge variant="outline" className={colorClass}>
                          {label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.ndisCode}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={item.supportDescription}>
                        {item.supportDescription}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{getItemHours(item)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(getItemUnitRate(item))}</TableCell>
                    <TableCell className="text-right">{item.weeks}</TableCell>
                    <TableCell className="text-right">{item.ratioOfSupport}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ServiceItemSelector
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        onAddItem={handleAddItem}
      />
    </Card>
  );
}