import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AssignRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignRoleModal({ isOpen, onClose }: AssignRoleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    userId: "",
    roleId: "",
  });

  // Fetch users and custom roles
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  const { data: customRoles = [] } = useQuery({
    queryKey: ['/api/custom-roles'],
    enabled: isOpen,
  });

  const assignRoleMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.userId || !data.roleId) {
        throw new Error("Please select both user and role");
      }
      
      return apiRequest('POST', '/api/user-role-assignments', {
        userId: parseInt(data.userId),
        roleId: parseInt(data.roleId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-role-assignments'] });
      toast({ title: "Role assigned successfully" });
      onClose();
      setFormData({ userId: "", roleId: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to assign role", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    assignRoleMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Custom Role</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="userId">User</Label>
            <Select 
              value={formData.userId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, userId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.firstName} {user.lastName} ({user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="roleId">Custom Role</Label>
            <Select 
              value={formData.roleId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, roleId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select custom role" />
              </SelectTrigger>
              <SelectContent>
                {customRoles.map((role: any) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={assignRoleMutation.isPending}
            >
              {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}