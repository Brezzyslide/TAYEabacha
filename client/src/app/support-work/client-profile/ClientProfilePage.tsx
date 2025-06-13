import { useState, Suspense, lazy } from "react";
import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

// Lazy load tab components
const OverviewTab = lazy(() => import("./tabs/overview"));
const MedicationsTab = lazy(() => import("./tabs/medications"));
const CarePlansTab = lazy(() => import("./tabs/care-plans"));
const CaseNotesTab = lazy(() => import("./tabs/case-notes"));
const IncidentsTab = lazy(() => import("./tabs/incidents"));
const SchedulesTab = lazy(() => import("./tabs/schedules"));
const ObservationsTab = lazy(() => import("./tabs/observations"));

interface ClientProfilePageProps {
  clientId?: string;
  companyId?: string;
}

export default function ClientProfilePage({ clientId: propClientId, companyId: propCompanyId }: ClientProfilePageProps) {
  const params = useParams();
  const clientId = propClientId || params.clientId || "1";
  const companyId = propCompanyId || "1";
  const [activeTab, setActiveTab] = useState("overview");

  // Mock client data - in real app would come from useQuery
  const clientData = {
    id: clientId,
    name: "Sarah Johnson",
    ndisNumber: "43000012345",
    status: "Active",
    planType: "Core Support",
    dateOfBirth: "1985-03-15",
    address: "123 Oak Street, Melbourne VIC 3000"
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Client Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{clientData.name}</CardTitle>
              <p className="text-muted-foreground">NDIS: {clientData.ndisNumber}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{clientData.status}</Badge>
              <Badge variant="secondary">{clientData.planType}</Badge>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>DOB: {clientData.dateOfBirth}</p>
            <p>{clientData.address}</p>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="care-plans">Care Plans</TabsTrigger>
          <TabsTrigger value="case-notes">Case Notes</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="observations">Observations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <OverviewTab clientId={clientId} companyId={companyId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="medications" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <MedicationsTab clientId={clientId} companyId={companyId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="care-plans" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <CarePlansTab clientId={clientId} companyId={companyId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="case-notes" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <CaseNotesTab clientId={clientId} companyId={companyId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="incidents" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <IncidentsTab clientId={clientId} companyId={companyId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="schedules" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <SchedulesTab clientId={clientId} companyId={companyId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="observations" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <ObservationsTab clientId={clientId} companyId={companyId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}