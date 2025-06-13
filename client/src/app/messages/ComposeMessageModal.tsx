import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X, Users, UserCheck, AlertTriangle, MessageSquare } from "lucide-react";

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

interface ComposeMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
}

const composeMessageSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  messageType: z.enum(["quick", "urgent"]),
  body: z.string().min(1, "Message body is required").max(5000, "Message too long"),
  sendToAll: z.boolean().default(false),
  selectedRecipients: z.array(z.number()).min(0),
  selectedRoles: z.array(z.string()).optional(),
  attachments: z.array(z.any()).optional(),
});

type ComposeMessageForm = z.infer<typeof composeMessageSchema>;

export default function ComposeMessageModal({ isOpen, onClose, users }: ComposeMessageModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ComposeMessageForm>({
    resolver: zodResolver(composeMessageSchema),
    defaultValues: {
      subject: "",
      messageType: "quick",
      body: "",
      sendToAll: false,
      selectedRecipients: [],
      selectedRoles: [],
      attachments: [],
    },
  });

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/messages", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      });
      onClose();
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    form.reset();
    setSelectedUsers([]);
    setSelectedRoles([]);
    setSendToAll(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  // Get unique roles from users
  const availableRoles = Array.from(new Set(users.map(u => u.role))).filter(role => role);

  // Get recipients based on selection
  const getRecipientIds = () => {
    if (sendToAll) {
      return users.filter(u => u.id !== user?.id).map(u => u.id);
    }

    let recipients: number[] = [...selectedUsers];

    // Add users by role
    selectedRoles.forEach(role => {
      const roleUsers = users.filter(u => u.role === role && u.id !== user?.id);
      roleUsers.forEach(u => {
        if (!recipients.includes(u.id)) {
          recipients.push(u.id);
        }
      });
    });

    return recipients;
  };

  const handleUserSelection = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleRoleSelection = (role: string, checked: boolean) => {
    if (checked) {
      setSelectedRoles(prev => [...prev, role]);
    } else {
      setSelectedRoles(prev => prev.filter(r => r !== role));
    }
  };

  const handleSendToAllChange = (checked: boolean) => {
    setSendToAll(checked);
    if (checked) {
      setSelectedUsers([]);
      setSelectedRoles([]);
    }
  };

  const onSubmit = async (data: ComposeMessageForm) => {
    const recipientIds = getRecipientIds();
    
    if (recipientIds.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please select at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    const messageData = {
      subject: data.subject,
      body: data.body,
      messageType: data.messageType,
      recipientIds,
      attachments: data.attachments || [],
      senderId: user?.id,
      tenantId: user?.tenantId,
    };

    await createMessageMutation.mutateAsync(messageData);
  };

  const recipientCount = getRecipientIds().length;
  const canSendToAll = user?.role === "admin" || user?.role === "manager";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Compose Message</span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter message subject..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Message Type */}
            <FormField
              control={form.control}
              name="messageType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select message type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="quick">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                          <span>Quick Update</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span>Urgent Update</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recipients */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Recipients</Label>
              
              {/* Send to All */}
              {canSendToAll && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendToAll"
                    checked={sendToAll}
                    onCheckedChange={handleSendToAllChange}
                  />
                  <Label htmlFor="sendToAll" className="flex items-center space-x-2 cursor-pointer">
                    <Users className="h-4 w-4" />
                    <span>Send to All Staff</span>
                  </Label>
                </div>
              )}

              {!sendToAll && (
                <>
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Select by Role:</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {availableRoles.map(role => (
                        <div key={role} className="flex items-center space-x-2">
                          <Checkbox
                            id={`role-${role}`}
                            checked={selectedRoles.includes(role)}
                            onCheckedChange={(checked) => handleRoleSelection(role, checked as boolean)}
                          />
                          <Label htmlFor={`role-${role}`} className="cursor-pointer capitalize">
                            {role} ({users.filter(u => u.role === role && u.id !== user?.id).length})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Individual User Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Select Individual Users:</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-2">
                      {users
                        .filter(u => u.id !== user?.id)
                        .map(u => (
                          <div key={u.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`user-${u.id}`}
                              checked={selectedUsers.includes(u.id)}
                              onCheckedChange={(checked) => handleUserSelection(u.id, checked as boolean)}
                            />
                            <Label htmlFor={`user-${u.id}`} className="cursor-pointer flex-1">
                              <div className="flex items-center justify-between">
                                <span>{u.fullName || u.username}</span>
                                <Badge variant="outline" className="text-xs">
                                  {u.role}
                                </Badge>
                              </div>
                            </Label>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

              {/* Recipient Count */}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <UserCheck className="h-4 w-4" />
                <span>
                  {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} selected
                </span>
              </div>
            </div>

            {/* Message Body */}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your message..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">
                Message will be sent to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
              </div>
              <div className="flex space-x-3">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMessageMutation.isPending || recipientCount === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createMessageMutation.isPending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}