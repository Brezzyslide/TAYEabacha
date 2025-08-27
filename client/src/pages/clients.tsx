import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type Client } from "@shared/schema";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { PermissionGuard, usePermission } from "@/components/auth/PermissionGuard";

const clientFormSchema = insertClientSchema.omit({ tenantId: true, createdBy: true });

type ClientFormData = z.infer<typeof clientFormSchema>;

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ClientFormData> }) => {
      const res = await apiRequest("PUT", `/api/clients/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsDialogOpen(false);
      setEditingClient(null);
      form.reset();
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      address: "",
      careLevel: "",
      emergencyContact: "",
      isActive: true,
    },
  });

  const onSubmit = (data: ClientFormData) => {
    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data });
    } else {
      createClientMutation.mutate(data);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    form.reset({
      fullName: client.fullName,
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      careLevel: client.careLevel || "",
      emergencyContact: client.emergencyContact || "",
      dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth) : undefined,
      isActive: client.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this client?")) {
      deleteClientMutation.mutate(id);
    }
  };

  const filteredClients = clients?.filter(client =>
    client.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone?.includes(searchQuery)
  ) || [];

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

  return (
    <div className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
                <p className="text-gray-600 mt-1">Manage your client database</p>
              </div>
              
              <PermissionGuard 
                module="clients" 
                action="create"
                fallback={
                  <Button disabled className="opacity-50">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client (No Permission)
                  </Button>
                }
              >
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingClient(null); form.reset(); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Client
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingClient ? "Edit Client" : "Add New Client"}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input
                          id="fullName"
                          {...form.register("fullName")}
                          placeholder="Enter client's full name"
                        />
                        {form.formState.errors.fullName && (
                          <p className="text-sm text-destructive mt-1">
                            {form.formState.errors.fullName.message}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          {...form.register("phone")}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          {...form.register("email")}
                          placeholder="client@example.com"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          {...form.register("dateOfBirth", {
                            valueAsDate: true,
                          })}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        {...form.register("address")}
                        placeholder="123 Main St, City, State 12345"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="careLevel">Care Level</Label>
                      <Select
                        value={form.watch("careLevel") || ""}
                        onValueChange={(value) => form.setValue("careLevel", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select care level..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="independent">Independent</SelectItem>
                          <SelectItem value="assisted">Assisted</SelectItem>
                          <SelectItem value="memory_care">Memory Care</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="emergencyContact">Emergency Contact</Label>
                      <Textarea
                        id="emergencyContact"
                        {...form.register("emergencyContact")}
                        placeholder="Contact information and relationship"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createClientMutation.isPending || updateClientMutation.isPending}
                      >
                        {editingClient ? "Update Client" : "Create Client"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
                </Dialog>
              </PermissionGuard>
            </div>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Client Database</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading clients...</div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? "No clients found matching your search." : "No clients found. Add your first client to get started."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Care Level</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{client.fullName}</div>
                              {client.dateOfBirth && (
                                <div className="text-sm text-gray-500">
                                  DOB: {new Date(client.dateOfBirth).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {client.phone && <div className="text-sm">{client.phone}</div>}
                              {client.email && <div className="text-sm text-gray-500">{client.email}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getCareLevel(client.careLevel)}
                          </TableCell>
                          <TableCell>
                            {new Date(client.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.location.href = `/support-work/client-profile/${client.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Profile
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(client)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(client.id)}
                                disabled={deleteClientMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
