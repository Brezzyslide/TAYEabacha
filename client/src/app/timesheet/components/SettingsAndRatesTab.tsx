import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, DollarSign, TrendingUp } from "lucide-react";
import PayScaleManagement from "@/app/admin/PayScaleManagement";
import WageIncreaseManager from "@/app/admin/WageIncreaseManager";
import { TimesheetAutoSubmitSettings } from "@/app/admin/components/TimesheetAutoSubmitSettings";

export default function SettingsAndRatesTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="auto-submit" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auto-submit" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Auto-Submission
          </TabsTrigger>
          <TabsTrigger value="pay-scales" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pay Scales
          </TabsTrigger>
          <TabsTrigger value="wage-increases" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Wage Increases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auto-submit">
          <TimesheetAutoSubmitSettings />
        </TabsContent>

        <TabsContent value="pay-scales">
          <PayScaleManagement />
        </TabsContent>

        <TabsContent value="wage-increases">
          <WageIncreaseManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}