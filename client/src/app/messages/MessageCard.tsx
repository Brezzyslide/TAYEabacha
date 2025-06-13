import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Reply, Trash2, Clock, AlertTriangle, MessageSquare } from "lucide-react";
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

interface MessageCardProps {
  message: StaffMessage;
  currentUserId?: number;
  senderName: string;
  isRead: boolean;
  onView: () => void;
  onReply?: () => void;
  onDelete: () => void;
  showActions: boolean;
  isSentView?: boolean;
}

export default function MessageCard({
  message,
  currentUserId,
  senderName,
  isRead,
  onView,
  onReply,
  onDelete,
  showActions,
  isSentView = false
}: MessageCardProps) {
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
        return <AlertTriangle className="h-3 w-3" />;
      case 'quick':
        return <MessageSquare className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getRecipientCount = () => {
    return message.recipientIds.length;
  };

  return (
    <div className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
      !isRead && !isSentView ? 'bg-blue-50 border-blue-200' : 'bg-white'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          {/* Header with subject and badges */}
          <div className="flex items-center space-x-2 mb-2">
            <h3 className={`font-semibold truncate ${
              !isRead && !isSentView ? 'text-blue-900' : 'text-gray-900'
            }`}>
              {message.replyToId && "Re: "}{message.subject}
            </h3>
            
            <Badge className={`text-xs ${getMessageTypeColor(message.messageType)}`}>
              <div className="flex items-center space-x-1">
                {getMessageTypeIcon(message.messageType)}
                <span className="capitalize">{message.messageType}</span>
              </div>
            </Badge>

            {!isRead && !isSentView && (
              <Badge variant="default" className="bg-blue-600 text-white text-xs">
                New
              </Badge>
            )}

            {message.attachments && message.attachments.length > 0 && (
              <Badge variant="outline" className="text-xs">
                📎 {message.attachments.length}
              </Badge>
            )}
          </div>

          {/* Sender/Recipient Info */}
          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
            <span>
              {isSentView ? (
                <>To: {getRecipientCount()} recipient{getRecipientCount() > 1 ? 's' : ''}</>
              ) : (
                <>From: {senderName}</>
              )}
            </span>
            <span className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{format(new Date(message.createdAt), 'MMM dd, yyyy HH:mm')}</span>
            </span>
          </div>

          {/* Message Preview */}
          <p className="text-sm text-gray-700 mb-3">
            {truncateText(message.body)}
          </p>

          {/* Reply indicator */}
          {message.replyToId && (
            <div className="flex items-center space-x-1 text-xs text-gray-500 mb-2">
              <Reply className="h-3 w-3" />
              <span>Reply to previous message</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            className="flex items-center space-x-1"
          >
            <Eye className="h-3 w-3" />
            <span>View</span>
          </Button>

          {showActions && onReply && !isSentView && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReply}
              className="flex items-center space-x-1"
            >
              <Reply className="h-3 w-3" />
              <span>Reply</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="flex items-center space-x-1 text-red-600 hover:text-red-800 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Read status indicator for sent messages */}
      {isSentView && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Message sent to {getRecipientCount()} recipient{getRecipientCount() > 1 ? 's' : ''}</span>
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Delivered</span>
              </span>
              {Object.keys(message.isRead || {}).length > 0 && (
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>{Object.keys(message.isRead || {}).length} read</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}