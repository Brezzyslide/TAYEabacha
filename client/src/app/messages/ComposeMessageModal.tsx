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
    setSendToAll(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  // Get unique roles from users (excluding current user)
  const availableRoles = Array.from(new Set(
    users.filter(u => u.id !== user?.id).map(u => u.role)
  )).filter(role => role);

  // Get active staff from the same company/tenant (all users in API are active by default)
  const activeStaff = users.filter(u => u.id !== user?.id);

  // Get recipients based on selection
  const getRecipientIds = () => {
    if (sendToAll) {
      return activeStaff.map(u => u.id);
    }
    return selectedUsers;
  };

  const handleUserSelection = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };



  const handleSendToAllChange = (checked: boolean) => {
    setSendToAll(checked);
    if (checked) {
      setSelectedUsers([]);
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
  const canSendToAll = user?.role === "Admin" || user?.role === "Coordinator" || user?.role === "Manager";

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

            {/* Send to All Staff */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendToAll"
                checked={sendToAll}
                onCheckedChange={handleSendToAllChange}
              />
              <Users className="h-4 w-4" />
              <Label htmlFor="sendToAll" className="cursor-pointer">
                Send to All Staff
              </Label>
            </div>

            {/* Select Recipients */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Recipients</Label>
              
              <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto">
                {activeStaff.map(u => (
                  <div key={u.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-${u.id}`}
                      checked={sendToAll || selectedUsers.includes(u.id)}
                      disabled={sendToAll}
                      onCheckedChange={(checked) => handleUserSelection(u.id, checked as boolean)}
                    />
                    <Label htmlFor={`user-${u.id}`} className="cursor-pointer flex-1">
                      <span>{u.fullName || u.username} ({u.role?.toUpperCase() || 'STAFF'})</span>
                    </Label>
                  </div>
                ))}
                {activeStaff.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No other staff members found in your company
                  </p>
                )}
              </div>

              <div className="text-xs text-gray-500">
                {sendToAll ? (
                  <span>All staff members will receive this message</span>
                ) : (
                  <span>{recipientCount} recipient{recipientCount !== 1 ? 's' : ''} selected</span>
                )}
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