import IncidentDashboard from "../../../incident-management/IncidentDashboard";

interface IncidentsTabProps {
  clientId: string;
  companyId: string;
}

export default function IncidentsTab({ clientId, companyId }: IncidentsTabProps) {
  if (!clientId) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
        <p className="text-gray-600">Client ID is missing from URL.</p>
      </div>
    );
  }

  return (
    <IncidentDashboard
      clientId={parseInt(clientId)}
      title="Client Incident Reports"
      showStats={true}
    />
  );
}