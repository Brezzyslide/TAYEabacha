import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Reply, Download, AlertTriangle, MessageSquare, Clock, User, Users } from "lucide-react";
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

interface ViewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: StaffMessage;
  senderName: string;
  onReply: () => void;
}

export default function ViewMessageModal({
  isOpen,
  onClose,
  message,
  senderName,
  onReply
}: ViewMessageModalProps) {
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

  const handleDownloadAttachment = (attachment: any) => {
    // Handle attachment download
    console.log('Download attachment:', attachment);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getMessageTypeIcon(message.messageType)}
              <span className="truncate">{message.subject}</span>
            </div>
            <Badge className={`text-xs ${getMessageTypeColor(message.messageType)}`}>
              <div className="flex items-center space-x-1">
                {getMessageTypeIcon(message.messageType)}
                <span className="capitalize">{message.messageType}</span>
              </div>
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Message Header */}
          <div className="space-y-4">
            {/* From and To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">From:</span>
                <span className="font-medium">{senderName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">To:</span>
                <span className="font-medium">
                  {message.recipientIds.length} recipient{message.recipientIds.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Date and Time */}
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Sent:</span>
              <span className="font-medium">
                {format(new Date(message.createdAt), 'EEEE, MMMM dd, yyyy \'at\' HH:mm')}
              </span>
            </div>

            {/* Reply indicator */}
            {message.replyToId && (
              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <Reply className="h-4 w-4" />
                <span>This is a reply to a previous message</span>
              </div>
            )}

            {/* Read status */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Delivered to {message.recipientIds.length} recipient{message.recipientIds.length > 1 ? 's' : ''}</span>
              </div>
              {Object.keys(message.isRead || {}).length > 0 && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Read by {Object.keys(message.isRead || {}).length} recipient{Object.keys(message.isRead || {}).length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Message Body */}
          <div className="space-y-4">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
                {message.body}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                  <span>📎</span>
                  <span>Attachments ({message.attachments.length})</span>
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {message.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-blue-600">
                          📄
                        </div>
                        <div>
                          <p className="font-medium text-sm">{attachment.name || `Attachment ${index + 1}`}</p>
                          <p className="text-xs text-gray-500">
                            {attachment.size ? `${Math.round(attachment.size / 1024)} KB` : 'Unknown size'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAttachment(attachment)}
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              Message ID: {message.id}
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button 
                onClick={onReply}
                className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
              >
                <Reply className="h-4 w-4" />
                <span>Reply</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}