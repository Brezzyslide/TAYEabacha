import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PermissionOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleName: string;
  roleDisplayName: string;
}

const MODULES = [
  "Client Management",
  "Staff Management", 
  "Shift Management",
  "Case Notes",
  "Medication Management",
  "Incident Reports",
  "Hourly Observations",
  "Form Templates",
  "Hour Allocation",
  "Internal Messaging",
  "Roles & Permissions"
];

const ACTIONS = ["view", "create", "edit", "delete"];
const SCOPES = [
  { value: "assigned", label: "Assigned Only" },
  { value: "company", label: "Company-wide" },
  { value: "global", label: "Global (ConsoleManager only)" }
];

export default function PermissionOverrideModal({ 
  isOpen, 
  onClose, 
  roleName, 
  roleDisplayName 
}: PermissionOverrideModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    module: "",
    actions: [] as string[],
    scope: "",
  });

  const createPermissionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.module || data.actions.length === 0 || !data.scope) {
        throw new Error("Please fill in all fields");
      }
      
      return apiRequest('POST', '/api/custom-permissions', {
        roleName,
        module: data.module,
        actions: data.actions,
        scope: data.scope,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-permissions'] });
      toast({ title: `Permission override created for ${roleDisplayName}` });
      onClose();
      setFormData({ module: "", actions: [], scope: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create permission override", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleActionChange = (action: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      actions: checked 
        ? [...prev.actions, action]
        : prev.actions.filter(a => a !== action)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPermissionMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Override Permissions for {roleDisplayName}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="module">Module</Label>
            <Select 
              value={formData.module} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, module: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select module to override" />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map(module => (
                  <SelectItem key={module} value={module}>
                    {module}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Actions</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {ACTIONS.map(action => (
                <div key={action} className="flex items-center space-x-2">
                  <Checkbox 
                    id={action}
                    checked={formData.actions.includes(action)}
                    onCheckedChange={(checked) => handleActionChange(action, checked as boolean)}
                  />
                  <Label 
                    htmlFor={action} 
                    className="text-sm font-normal capitalize"
                  >
                    {action}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="scope">Scope</Label>
            <Select 
              value={formData.scope} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, scope: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select permission scope" />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map(scope => (
                  <SelectItem key={scope.value} value={scope.value}>
                    {scope.label}
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
              disabled={createPermissionMutation.isPending}
            >
              {createPermissionMutation.isPending ? "Creating..." : "Create Override"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}