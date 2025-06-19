import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Reply, User, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface StaffMessage {
  id: number;
  senderId: number;
  recipientIds: number[];
  subject: string;
  body: string;
  messageType: "quick" | "urgent";
  attachments: any[];
  replyToId?: number;
  isRead: Record<string, boolean>;
  tenantId: number;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

interface ReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalMessage: StaffMessage;
  users: User[];
}

const replyMessageSchema = z.object({
  body: z.string().min(1, "Reply message is required").max(5000, "Message too long"),
  attachments: z.array(z.any()).optional(),
});

type ReplyMessageForm = z.infer<typeof replyMessageSchema>;

export default function ReplyModal({ isOpen, onClose, originalMessage, users }: ReplyModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ReplyMessageForm>({
    resolver: zodResolver(replyMessageSchema),
    defaultValues: {
      body: "",
      attachments: [],
    },
  });

  // Create reply mutation
  const createReplyMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/messages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Reply Sent",
        description: "Your reply has been sent successfully.",
      });
      onClose();
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send reply. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    onClose();
    form.reset();
  };

  const getSenderName = (senderId: number) => {
    const sender = users.find(u => u.id === senderId);
    return sender ? sender.fullName || sender.username : 'Unknown User';
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'quick':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4" />;
      case 'quick':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const onSubmit = async (data: ReplyMessageForm) => {
    // Include original sender in reply recipients, plus all original recipients except current user
    const replyRecipients = [originalMessage.senderId];
    originalMessage.recipientIds.forEach(id => {
      if (id !== user?.id && !replyRecipients.includes(id)) {
        replyRecipients.push(id);
      }
    });

    const replyData = {
      subject: originalMessage.subject.startsWith("Re: ") 
        ? originalMessage.subject 
        : `Re: ${originalMessage.subject}`,
      body: data.body,
      messageType: originalMessage.messageType, // Keep same urgency level
      recipientIds: replyRecipients,
      replyToId: originalMessage.id,
      attachments: data.attachments || [],
      senderId: user?.id,
      tenantId: user?.tenantId,
    };

    await createReplyMutation.mutateAsync(replyData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Reply className="h-5 w-5" />
            <span>Reply to Message</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Message Preview */}
          <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-gray-900">Original Message</h4>
                <Badge className={`text-xs ${getMessageTypeColor(originalMessage.messageType)}`}>
                  <div className="flex items-center space-x-1">
                    {getMessageTypeIcon(originalMessage.messageType)}
                    <span className="capitalize">{originalMessage.messageType}</span>
                  </div>
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <User className="h-3 w-3" />
                  <span>From: {getSenderName(originalMessage.senderId)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(originalMessage.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                </div>
              </div>

              <div className="font-medium text-gray-900">
                {originalMessage.subject}
              </div>

              <div className="text-sm text-gray-700 max-h-32 overflow-y-auto bg-white p-3 rounded border">
                <div className="whitespace-pre-wrap">
                  {originalMessage.body.length > 300 
                    ? `${originalMessage.body.substring(0, 300)}...` 
                    : originalMessage.body}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reply Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Reply Details */}
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <strong>Subject:</strong> {originalMessage.subject.startsWith("Re: ") 
                    ? originalMessage.subject 
                    : `Re: ${originalMessage.subject}`}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>To:</strong> {getSenderName(originalMessage.senderId)}
                  {originalMessage.recipientIds.filter(id => id !== user?.id).length > 0 && 
                    ` and ${originalMessage.recipientIds.filter(id => id !== user?.id).length} other${originalMessage.recipientIds.filter(id => id !== user?.id).length > 1 ? 's' : ''}`}
                </div>
              </div>

              {/* Reply Message */}
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Reply</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Type your reply here..."
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
                  Reply will be sent to {1 + originalMessage.recipientIds.filter(id => id !== user?.id).length} recipient{1 + originalMessage.recipientIds.filter(id => id !== user?.id).length > 1 ? 's' : ''}
                </div>
                <div className="flex space-x-3">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createReplyMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                  >
                    <Reply className="h-4 w-4" />
                    <span>
                      {createReplyMutation.isPending ? "Sending..." : "Send Reply"}
                    </span>
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}