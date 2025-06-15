import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ClientProfileDemo() {
  const params = useParams();
  const clientId = params.clientId || "1";

  // Mock client data
  const clientData = {
    id: clientId,
    name: "Sarah Johnson",
    ndisNumber: "43000012345",
    status: "Active",
    planType: "Core Support",
    dateOfBirth: "1985-03-15",
    address: "123 Oak Street, Melbourne VIC 3000"
  };

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

      {/* Content Area */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">
            <p className="text-lg mb-2">Client Profile</p>
            <p>Tab navigation has been removed. Use the main navigation to access client-related features.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}