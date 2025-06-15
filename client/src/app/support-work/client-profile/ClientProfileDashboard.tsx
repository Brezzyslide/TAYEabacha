import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Grid, List, Filter, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Edit, Archive } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission, isAdmin } from "@/lib/auth";
import { Client } from "@shared/schema";
import { ClientProfileCard } from "./components/ClientProfileCard";
import { ClientQuickViewModal } from "./components/ClientQuickViewModal";
import { useLocation } from "wouter";

type ViewMode = "card" | "list";

export default function ClientProfileDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [, setLocation] = useLocation();
  
  const { user } = useAuth();

  // Fetch clients based on user role and permissions
  const { data: clients, isLoading, error } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !!user,
  });

  // Filter clients based on role and search query
  const filteredClients = useMemo(() => {
    if (!clients || !user) return [];

    let clientsToShow = clients;

    // Apply role-based filtering
    const userWithPermissions = user as any; // Type assertion for clientAssignments
    if (!isAdmin(userWithPermissions)) {
      // For non-admin users, show only assigned clients
      // Note: In a real implementation, user.clientAssignments would contain assigned client IDs
      const assignedClientIds = userWithPermissions.clientAssignments || [];
      if (assignedClientIds.length > 0) {
        clientsToShow = clients.filter(client => assignedClientIds.includes(client.id));
      } else {
        // If no assignments, show all clients for now (temporary for demo)
        clientsToShow = clients;
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      clientsToShow = clientsToShow.filter(client => 
        client.fullName.toLowerCase().includes(query) ||
        client.ndisNumber?.toLowerCase().includes(query) ||
        client.firstName.toLowerCase().includes(query) ||
        client.lastName.toLowerCase().includes(query)
      );
    }

    return clientsToShow;
  }, [clients, user, searchQuery]);

  // Permission checks
  const canCreateClients = user && hasPermission(user as any, "clients", "create");
  const canEditClients = user && hasPermission(user as any, "clients", "edit");
  const canArchiveClients = user && hasPermission(user as any, "clients", "delete");

  // Handlers
  const handleQuickView = (client: Client) => {
    setSelectedClient(client);
    setIsQuickViewOpen(true);
  };

  const handleEdit = (client: Client) => {
    setLocation(`/clients?edit=${client.id}`);
  };

  const handleArchive = (clientId: number) => {
    console.log("Archive client:", clientId);
    // TODO: Implement archive functionality
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Not set";
    const d = new Date(date);
    return d.toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getCareLevel = (level: string | null) => {
    switch (level) {
      case "independent":
        return <Badge variant="secondary">Independent</Badge>;
      case "assisted":
        return <Badge variant="default">Assisted</Badge>;
      case "memory_care":
        return <Badge variant="destructive">Memory Care</Badge>;
      default:
        return <Badge variant="outline">Not Set</Badge>;
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            Error loading clients. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Client Profiles</h1>
          <p className="text-gray-600 mt-1">
            {user && isAdmin(user as any) ? "Manage all clients in your company" : "View your assigned clients"}
          </p>
        </div>
        
        {canCreateClients && (
          <Button onClick={() => setLocation("/clients")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add New Client
          </Button>
        )}
      </div>

      {/* Search and View Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or NDIS number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center mt-2 space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {filteredClients.length} of {clients?.length || 0} clients
                </span>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <div className="flex items-center border rounded-md">
                <Toggle
                  pressed={viewMode === "card"}
                  onPressedChange={() => setViewMode("card")}
                  className="rounded-r-none border-r"
                  size="sm"
                >
                  <Grid className="h-4 w-4" />
                </Toggle>
                <Toggle
                  pressed={viewMode === "list"}
                  onPressedChange={() => setViewMode("list")}
                  className="rounded-l-none"
                  size="sm"
                >
                  <List className="h-4 w-4" />
                </Toggle>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Content Area */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ? "Try adjusting your search criteria" : "Get started by adding your first client"}
              </p>
              {canCreateClients && !searchQuery && (
                <Button onClick={() => setLocation("/clients")}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <ClientProfileCard
              key={client.id}
              client={client}
              onQuickView={handleQuickView}
              onEdit={handleEdit}
              onArchive={handleArchive}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>NDIS Number</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Care Level</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow 
                    key={client.id} 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setLocation(`/support-work/client-profile/${client.id}`)}
                  >
                    <TableCell className="font-medium">{client.fullName}</TableCell>
                    <TableCell>{client.ndisNumber || "Not set"}</TableCell>
                    <TableCell>{formatDate(client.dateOfBirth)}</TableCell>
                    <TableCell>{getCareLevel(null)}</TableCell>
                    <TableCell>{"Not set"}</TableCell>
                    <TableCell>
                      <Badge variant={client.isActive ? "default" : "secondary"}>
                        {client.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleQuickView(client);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Quick View
                          </DropdownMenuItem>
                          {canEditClients && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(client);
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Client
                            </DropdownMenuItem>
                          )}
                          {canArchiveClients && (
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(client.id);
                              }}
                              className="text-red-600"
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick View Modal */}
      <ClientQuickViewModal
        client={selectedClient}
        isOpen={isQuickViewOpen}
        onClose={() => {
          setIsQuickViewOpen(false);
          setSelectedClient(null);
        }}
        onEdit={canEditClients ? handleEdit : undefined}
      />
    </div>
  );
}