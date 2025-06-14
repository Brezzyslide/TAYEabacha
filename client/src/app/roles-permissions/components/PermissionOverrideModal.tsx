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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCustomPermissionSchema } from "@shared/schema";

interface PermissionOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleName: string;
  roleDisplayName: string;
}

export default function PermissionOverrideModal({ 
  isOpen, 
  onClose, 
  roleName, 
  roleDisplayName 
}: PermissionOverrideModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedScope, setSelectedScope] = useState("");

  const createOverrideMutation = useMutation({
    mutationFn: async (data: any) => {
      const validatedData = insertCustomPermissionSchema.parse({
        ...data,
        isOverride: true,
        builtInRole: roleName,
      });
      return apiRequest('/api/custom-permissions', 'POST', validatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-permissions'] });
      toast({ title: "Permission override created successfully" });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create override", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setSelectedModule("");
    setSelectedActions([]);
    setSelectedScope("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedModule || selectedActions.length === 0 || !selectedScope) {
      toast({ 
        title: "Validation Error", 
        description: "Please select module, actions, and scope",
        variant: "destructive" 
      });
      return;
    }

    createOverrideMutation.mutate({
      module: selectedModule,
      actions: selectedActions,
      scope: selectedScope,
    });
  };

  const handleActionToggle = (action: string) => {
    setSelectedActions(prev => 
      prev.includes(action) 
        ? prev.filter(a => a !== action)
        : [...prev, action]
    );
  };

  const modules = [
    { value: "clients", label: "Client Management" },
    { value: "shifts", label: "Shift Management" },
    { value: "medications", label: "Medication Management" },
    { value: "case-notes", label: "Case Notes" },
    { value: "observations", label: "Hourly Observations" },
    { value: "incidents", label: "Incident Reports" },
    { value: "forms", label: "Dynamic Forms" },
    { value: "reports", label: "Reports & Analytics" },
    { value: "staff", label: "Staff Management" },
    { value: "care-plans", label: "Care Plans" },
  ];

  const actions = [
    { value: "view", label: "View" },
    { value: "create", label: "Create" },
    { value: "edit", label: "Edit" },
    { value: "delete", label: "Delete" },
    { value: "export", label: "Export" },
  ];

  const scopes = [
    { value: "assigned", label: "Assigned Clients Only", description: "Only clients assigned to this user" },
    { value: "company", label: "Company-wide", description: "All clients within the company" },
    { value: "global", label: "Global Access", description: "System-wide access (ConsoleManager only)" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Override Permissions for {roleDisplayName}
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create custom permission rules that override the default permissions for this built-in role.
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Module</Label>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger>
                <SelectValue placeholder="Select module to override..." />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.value} value={module.value}>
                    {module.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Actions</Label>
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action) => (
                <div key={action.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={action.value}
                    checked={selectedActions.includes(action.value)}
                    onCheckedChange={() => handleActionToggle(action.value)}
                  />
                  <Label htmlFor={action.value} className="text-sm font-normal">
                    {action.label}
                  </Label>
                </div>
              ))}
            </div>
            {selectedActions.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {selectedActions.map(action => (
                  <Badge key={action} variant="secondary" className="text-xs">
                    {action}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Access Scope</Label>
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger>
                <SelectValue placeholder="Select access scope..." />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    <div>
                      <div className="font-medium">{scope.label}</div>
                      <div className="text-xs text-gray-500">{scope.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
              Permission Override
            </h4>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              This will override the default permissions for <strong>{roleDisplayName}</strong> users 
              in the <strong>{selectedModule}</strong> module. All users with this role will be affected.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createOverrideMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {createOverrideMutation.isPending ? "Creating Override..." : "Create Override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}