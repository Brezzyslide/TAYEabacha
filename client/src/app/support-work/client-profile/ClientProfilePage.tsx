import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Home, AlertCircle } from "lucide-react";
import OverviewTab from "./tabs/overview";
import MedicationsTab from "./tabs/medications";
import CarePlansTab from "./tabs/care-plans";
import CaseNotesTab from "./tabs/case-notes";
import IncidentsTab from "./tabs/incidents";
import SchedulesTab from "./tabs/schedules";
import ObservationsTab from "./tabs/observations";

interface ClientProfilePageProps {
  clientId?: string;
  companyId?: string;
}

function ClientProfilePageInner({ clientId: propClientId, companyId: propCompanyId }: ClientProfilePageProps) {
  const params = useParams();
  const clientId = propClientId || params.clientId;
  const companyId = propCompanyId || "1";
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch real client data
  const { data: clientData, isLoading: clientLoading, error } = useQuery({
    queryKey: ["/api/clients", clientId],
    queryFn: () => fetch(`/api/clients/${clientId}`).then(res => res.json()),
    enabled: !!clientId,
  });

  // Handle missing clientId
  if (!clientId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Invalid Client ID</h3>
            <p className="text-gray-600 mb-4">No client ID provided in the URL.</p>
            <Link href="/support-work/client-profile">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Client List
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );

  if (clientLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading client profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !clientData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
            <p className="text-gray-600 mb-4">Unable to load client profile.</p>
            <Link href="/clients">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Clients
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* Client Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{clientData.firstName} {clientData.lastName}</CardTitle>
              <p className="text-muted-foreground">
                {clientData.clientId} {clientData.ndisNumber && `• NDIS: ${clientData.ndisNumber}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">Active</Badge>
              {clientData.ndisNumber && <Badge variant="secondary">NDIS Client</Badge>}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {clientData.dateOfBirth && (
              <p>DOB: {new Date(clientData.dateOfBirth).toLocaleDateString()}</p>
            )}
            {clientData.address && <p>{clientData.address}</p>}
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
          <OverviewTab clientId={clientId!} companyId={companyId} />
        </TabsContent>

        <TabsContent value="medications" className="mt-6">
          <MedicationsTab clientId={clientId!} companyId={companyId} />
        </TabsContent>

        <TabsContent value="care-plans" className="mt-6">
          <CarePlansTab clientId={clientId!} companyId={companyId} />
        </TabsContent>

        <TabsContent value="case-notes" className="mt-6">
          <CaseNotesTab clientId={clientId!} companyId={companyId} />
        </TabsContent>

        <TabsContent value="incidents" className="mt-6">
          <IncidentsTab clientId={clientId!} companyId={companyId} />
        </TabsContent>

        <TabsContent value="schedules" className="mt-6">
          <SchedulesTab clientId={clientId!} companyId={companyId} />
        </TabsContent>

        <TabsContent value="observations" className="mt-6">
          <ObservationsTab clientId={clientId!} companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Router wrapper component
export default function ClientProfilePage() {
  return <ClientProfilePageInner />;
}