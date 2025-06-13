import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreVertical, User, Phone, MapPin, Eye, Edit, Archive, Heart } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Client } from "@shared/schema";

interface ClientCardProps {
  client: Client;
  onQuickView: (client: Client) => void;
  onArchive: (client: Client) => void;
}

const ClientCard = ({ client, onQuickView, onArchive }: ClientCardProps) => {
  const hasAllergies = client.allergiesMedicalAlerts && client.allergiesMedicalAlerts.trim().length > 0;
  
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              {client.fullName}
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              NDIS: {client.ndisNumber}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ID: {client.clientId}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onQuickView(client)}>
                <Eye className="mr-2 h-4 w-4" />
                Quick View
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/support-work/client-profile?clientId=${client.clientId}`}>
                  <User className="mr-2 h-4 w-4" />
                  Full Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/support-work/client-profile/edit?clientId=${client.clientId}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(client)} className="text-red-600">
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Address */}
          {client.address && (
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{client.address}</span>
            </div>
          )}
          
          {/* Emergency Contact */}
          {client.emergencyContactName && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span>
                {client.emergencyContactName}
                {client.emergencyContactPhone && ` • ${client.emergencyContactPhone}`}
              </span>
            </div>
          )}
          
          {/* Tags */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Active
            </Badge>
            
            {hasAllergies && (
              <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                <Heart className="w-3 h-3 mr-1" />
                Allergies
              </Badge>
            )}
            
            {client.careLevel && (
              <Badge variant="outline" className="capitalize">
                {client.careLevel.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface QuickViewModalProps {
  client: Client | null;
  onClose: () => void;
}

const QuickViewModal = ({ client, onClose }: QuickViewModalProps) => {
  if (!client) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{client.fullName}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">NDIS Number:</span>
                  <p className="font-medium">{client.ndisNumber}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Client ID:</span>
                  <p className="font-medium">{client.clientId}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Care Level:</span>
                  <p className="font-medium capitalize">{client.careLevel?.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Date of Birth:</span>
                  <p className="font-medium">
                    {client.dateOfBirth ? new Date(client.dateOfBirth).toLocaleDateString() : 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
            
            {client.emergencyContactName && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Emergency Contact</h3>
                <p className="text-sm">
                  {client.emergencyContactName}
                  {client.emergencyContactPhone && ` • ${client.emergencyContactPhone}`}
                </p>
              </div>
            )}
            
            {client.allergiesMedicalAlerts && (
              <div>
                <h3 className="font-medium text-red-700 dark:text-red-400 mb-2">Medical Alerts</h3>
                <p className="text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  {client.allergiesMedicalAlerts}
                </p>
              </div>
            )}
            
            {client.ndisGoals && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">NDIS Goals</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {client.ndisGoals}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button asChild>
              <Link href={`/support-work/client-profile?clientId=${client.clientId}`}>
                View Full Profile
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ClientListPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !!user,
  });

  const filteredClients = clients.filter(client =>
    client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.ndisNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.clientId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleQuickView = (client: Client) => {
    setSelectedClient(client);
  };

  const handleArchive = (client: Client) => {
    // TODO: Implement archive functionality
    console.log("Archive client:", client.clientId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage client profiles and information
          </p>
        </div>
        
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href="/support-work/client-profile/create">
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, NDIS number, or client ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onQuickView={handleQuickView}
            onArchive={handleArchive}
          />
        ))}
      </div>

      {filteredClients.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No clients found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? "Try adjusting your search terms" : "Get started by adding a new client"}
          </p>
          {!searchTerm && (
            <div className="mt-6">
              <Button asChild>
                <Link href="/support-work/client-profile/create">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
      />
    </div>
  );
}