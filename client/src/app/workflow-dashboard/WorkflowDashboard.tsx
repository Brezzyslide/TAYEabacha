import { Separator } from "@/components/ui/separator";
import AutoInsightsPanel from "./components/AutoInsightsPanel";
import ManualTaskBoard from "./components/ManualTaskBoard";

export default function WorkflowDashboard() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor system alerts and manage manual tasks
          </p>
        </div>
      </div>

      <Separator />

      {/* Auto Insights Panel - Top Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">🔔 Workflow Alerts (System-Generated)</h2>
        </div>
        <AutoInsightsPanel />
      </section>

      <Separator className="my-8" />

      {/* Manual Task Board - Bottom Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">📋 Task Board (Manual Tasks)</h2>
        </div>
        <ManualTaskBoard />
      </section>
    </div>
  );
}