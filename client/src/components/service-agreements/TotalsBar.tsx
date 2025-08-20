import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@shared/utils/calc";
import { calculateRatioMultiplier } from "@shared/utils/ratioCalculator";
import { Calculator, DollarSign } from "lucide-react";
import type { ServiceAgreementItem } from "@shared/schema";

interface TotalsBarProps {
  items: ServiceAgreementItem[];
}

export default function TotalsBar({ items }: TotalsBarProps) {
  // Helper function to safely convert values to numbers
  const toNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (typeof value === 'object' && value.toNumber) return value.toNumber(); // For Decimal objects
    return Number(value) || 0;
  };

  // Calculate totals by rate type
  const calculateTotalsByRate = () => {
    const totals = {
      dayTotal: 0,
      eveningTotal: 0,
      activeNightTotal: 0,
      sleeperTotal: 0,
      saturdayTotal: 0,
      sundayTotal: 0,
      holidayTotal: 0,
    };

    items.forEach(item => {
      const weeks = toNumber(item.weeks) || 1;
      const ratioMultiplier = calculateRatioMultiplier(item.ratioOfSupport || "1:1");
      
      // Support both field naming patterns (old and new)
      totals.dayTotal += toNumber(item.hoursDay) * toNumber(item.unitDay) * ratioMultiplier * weeks;
      
      // Evening - check both hoursEvening and hoursWeekdayEvening
      const eveningHours = toNumber(item.hoursEvening) || toNumber(item.hoursWeekdayEvening);
      const eveningRate = toNumber(item.unitEvening) || toNumber(item.unitWeekdayEvening);
      totals.eveningTotal += eveningHours * eveningRate * ratioMultiplier * weeks;
      
      totals.activeNightTotal += toNumber(item.hoursActiveNight) * toNumber(item.unitActiveNight) * ratioMultiplier * weeks;
      totals.sleeperTotal += toNumber(item.hoursSleepover) * toNumber(item.unitSleepover) * ratioMultiplier * weeks;
      totals.saturdayTotal += toNumber(item.hoursSaturday) * toNumber(item.unitSaturday) * ratioMultiplier * weeks;
      totals.sundayTotal += toNumber(item.hoursSunday) * toNumber(item.unitSunday) * ratioMultiplier * weeks;
      totals.holidayTotal += toNumber(item.hoursPublicHoliday) * toNumber(item.unitPublicHoliday) * ratioMultiplier * weeks;
    });

    return totals;
  };

  const calculateGrandTotal = () => {
    return items.reduce((total, item) => {
      const weeks = toNumber(item.weeks) || 1;
      const ratioMultiplier = calculateRatioMultiplier(item.ratioOfSupport || "1:1");
      
      // Support both field naming patterns
      const eveningHours = toNumber(item.hoursEvening) || toNumber(item.hoursWeekdayEvening);
      const eveningRate = toNumber(item.unitEvening) || toNumber(item.unitWeekdayEvening);
      
      const itemTotal = 
        toNumber(item.hoursDay) * toNumber(item.unitDay) * ratioMultiplier +
        eveningHours * eveningRate * ratioMultiplier +
        toNumber(item.hoursActiveNight) * toNumber(item.unitActiveNight) * ratioMultiplier +
        toNumber(item.hoursSleepover) * toNumber(item.unitSleepover) * ratioMultiplier +
        toNumber(item.hoursSaturday) * toNumber(item.unitSaturday) * ratioMultiplier +
        toNumber(item.hoursSunday) * toNumber(item.unitSunday) * ratioMultiplier +
        toNumber(item.hoursPublicHoliday) * toNumber(item.unitPublicHoliday) * ratioMultiplier;
      
      return total + (itemTotal * weeks);
    }, 0);
  };

  const calculateTotalHours = () => {
    return items.reduce((total, item) => {
      const weeks = toNumber(item.weeks) || 1;
      
      // Support both field naming patterns
      const eveningHours = toNumber(item.hoursEvening) || toNumber(item.hoursWeekdayEvening);
      
      const itemHours = 
        toNumber(item.hoursDay) +
        eveningHours +
        toNumber(item.hoursActiveNight) +
        toNumber(item.hoursSleepover) +
        toNumber(item.hoursSaturday) +
        toNumber(item.hoursSunday) +
        toNumber(item.hoursPublicHoliday);
      
      return total + (itemHours * weeks);
    }, 0);
  };

  const totals = calculateTotalsByRate();
  const grandTotal = calculateGrandTotal();
  const totalHours = calculateTotalHours();

  if (items.length === 0) {
    return null;
  }

  const rateBreakdown = [
    { label: "Standard Day", amount: totals.dayTotal, show: totals.dayTotal > 0 },
    { label: "Weekday Evening", amount: totals.eveningTotal, show: totals.eveningTotal > 0 },
    { label: "Active Night", amount: totals.activeNightTotal, show: totals.activeNightTotal > 0 },
    { label: "Sleepover", amount: totals.sleeperTotal, show: totals.sleeperTotal > 0 },
    { label: "Saturday", amount: totals.saturdayTotal, show: totals.saturdayTotal > 0 },
    { label: "Sunday", amount: totals.sundayTotal, show: totals.sundayTotal > 0 },
    { label: "Public Holiday", amount: totals.holidayTotal, show: totals.holidayTotal > 0 },
  ].filter(rate => rate.show);

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
            Agreement Totals
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Rate Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Breakdown by Rate Type
            </h4>
            <div className="space-y-2">
              {rateBreakdown.map((rate, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {rate.label}
                  </span>
                  <span className="text-sm font-medium">
                    ${rate.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              
              {rateBreakdown.length > 1 && (
                <>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Subtotal</span>
                    <span className="text-sm font-medium">
                      ${grandTotal.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Agreement Summary
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Total Service Items
                </span>
                <span className="text-sm font-medium">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Total Service Hours
                </span>
                <span className="text-sm font-medium">
                  {totalHours.toFixed(2)} hours
                </span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Grand Total
                  </span>
                </div>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Average Rate */}
        {totalHours > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Average Rate
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                ${(grandTotal / totalHours).toFixed(2)} per hour
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}