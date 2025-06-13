import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Edit, Archive, User, Calendar, Hash } from "lucide-react";
import { Client } from "@shared/schema";
import { usePermission } from "@/components/auth/PermissionGuard";
import { useLocation } from "wouter";

interface ClientProfileCardProps {
  client: Client;
  onQuickView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onArchive: (clientId: number) => void;
}

export function ClientProfileCard({ client, onQuickView, onEdit, onArchive }: ClientProfileCardProps) {
  const [, setLocation] = useLocation();
  const canEdit = usePermission("clients", "edit");
  const canArchive = usePermission("clients", "delete");

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

  const handleCardClick = () => {
    setLocation(`/support-work/client-profile/${client.id}`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={handleCardClick}>
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
              {client.fullName}
            </h3>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Hash className="w-4 h-4" />
                <span>{client.ndisNumber || "No NDIS"}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(client.dateOfBirth)}</span>
              </div>
            </div>
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
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(client)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Client Info
                </DropdownMenuItem>
              )}
              {canArchive && (
                <DropdownMenuItem 
                  onClick={() => onArchive(client.id)}
                  className="text-red-600"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent onClick={handleCardClick}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Care Level:</span>
            {getCareLevel(client.careLevel)}
          </div>
          
          {client.address && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Address:</span> {client.address}
            </div>
          )}
          
          {client.phone && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Phone:</span> {client.phone}
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <User className="w-3 h-3" />
              <span>Active Client</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${client.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}