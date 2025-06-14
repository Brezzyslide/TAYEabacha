import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCustomRoleSchema } from "@shared/schema";

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateRoleModal({ isOpen, onClose }: CreateRoleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    basedOnRole: "",
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log("Creating role with data:", data);
      
      // Clean up the data - remove empty basedOnRole field
      const cleanData = {
        ...data,
        basedOnRole: data.basedOnRole || null,
        description: data.description || null,
      };
      
      try {
        const validatedData = insertCustomRoleSchema.parse(cleanData);
        console.log("Validated data:", validatedData);
        return apiRequest('/api/custom-roles', 'POST', validatedData);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        throw validationError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-roles'] });
      toast({ title: "Custom role created successfully" });
      onClose();
      setFormData({ name: "", displayName: "", description: "", basedOnRole: "" });
    },
    onError: (error: any) => {
      console.error("Role creation error:", error);
      toast({ 
        title: "Failed to create role", 
        description: error.message || "Please check the console for details",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.displayName) {
      toast({ 
        title: "Validation Error", 
        description: "Name and display name are required",
        variant: "destructive" 
      });
      return;
    }

    createRoleMutation.mutate(formData);
  };

  const builtInRoles = [
    { value: "SupportWorker", label: "Support Worker" },
    { value: "TeamLeader", label: "Team Leader" },
    { value: "Coordinator", label: "Coordinator" },
    { value: "Admin", label: "Administrator" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Role Name</Label>
            <Input
              id="name"
              placeholder="e.g., SeniorSupportWorker"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500">
              Internal name (no spaces, camelCase recommended)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="e.g., Senior Support Worker"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500">
              Human-readable name shown in the interface
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basedOnRole">Based on Role (Optional)</Label>
            <Select
              value={formData.basedOnRole}
              onValueChange={(value) => setFormData({ ...formData, basedOnRole: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a base role..." />
              </SelectTrigger>
              <SelectContent>
                {builtInRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Inherit permissions from an existing role
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the role's purpose and responsibilities..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createRoleMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createRoleMutation.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}