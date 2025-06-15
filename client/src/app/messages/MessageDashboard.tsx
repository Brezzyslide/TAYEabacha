import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, MessageSquare, Send, Inbox, AlertTriangle, Clock } from "lucide-react";

import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ComposeMessageModal from "./ComposeMessageModal";
import ViewMessageModal from "./ViewMessageModal";
import ReplyModal from "./ReplyModal";
import MessageCard from "./MessageCard";

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
  sender?: {
    id: number;
    username: string;
    fullName: string;
  };
}

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

export default function MessageDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [messageTypeFilter, setMessageTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("inbox");
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<StaffMessage | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch staff messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/messages"],
    queryFn: async () => {
      const res = await fetch("/api/messages", {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
  });

  // Fetch users for sender/recipient info
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Mark message as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest(`/api/messages/${messageId}/read`, "PATCH", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest(`/api/messages/${messageId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Message Deleted",
        description: "The message has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter messages based on tab and criteria
  const filteredMessages = useMemo(() => {
    let filtered = [...messages];

    // Filter by tab (inbox/sent)
    if (activeTab === "inbox") {
      filtered = filtered.filter(msg => user?.id && msg.recipientIds.includes(user.id));
    } else if (activeTab === "sent") {
      filtered = filtered.filter(msg => msg.senderId === user?.id);
    }

    // Filter by message type
    if (messageTypeFilter !== "all") {
      filtered = filtered.filter(msg => msg.messageType === messageTypeFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.subject.toLowerCase().includes(lowercaseSearch) ||
        msg.body.toLowerCase().includes(lowercaseSearch) ||
        getSenderName(msg.senderId).toLowerCase().includes(lowercaseSearch)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages, activeTab, messageTypeFilter, searchTerm, user?.id]);

  const getSenderName = (senderId: number) => {
    const sender = users.find((u: User) => u.id === senderId);
    return sender ? sender.fullName || sender.username : 'Unknown User';
  };

  const isMessageRead = (message: StaffMessage) => {
    return message.isRead && message.isRead[user?.id?.toString() || ""];
  };

  const getUnreadCount = () => {
    if (!user?.id) return 0;
    return messages.filter((msg: StaffMessage) => 
      msg.recipientIds.includes(user.id) && !isMessageRead(msg)
    ).length;
  };

  const getUrgentCount = () => {
    if (!user?.id) return 0;
    return messages.filter((msg: StaffMessage) => 
      msg.recipientIds.includes(user.id) && 
      msg.messageType === "urgent" && 
      !isMessageRead(msg)
    ).length;
  };

  const handleViewMessage = (message: StaffMessage) => {
    setSelectedMessage(message);
    setIsViewModalOpen(true);
    
    // Mark as read if it's in user's inbox and not already read
    if (user?.id && message.recipientIds.includes(user.id) && !isMessageRead(message)) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const handleReplyMessage = (message: StaffMessage) => {
    setSelectedMessage(message);
    setIsReplyModalOpen(true);
  };

  const handleDeleteMessage = (messageId: number) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  if (messagesLoading) {
    return (
      <div className="text-center py-12">Loading messages...</div>
    );
  }

  return (
    <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Staff Messages</h1>
                <p className="text-gray-600">Internal communication system</p>
              </div>
            </div>
            <Button 
              onClick={() => setIsComposeModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Compose Message
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Inbox className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Unread Messages</p>
                    <p className="text-2xl font-bold">{getUnreadCount()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Urgent Unread</p>
                    <p className="text-2xl font-bold">{getUrgentCount()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Send className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Sent Today</p>
                    <p className="text-2xl font-bold">
                      {messages.filter((msg: StaffMessage) => 
                        msg.senderId === user?.id && 
                        format(new Date(msg.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      ).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Messages</p>
                    <p className="text-2xl font-bold">{messages.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search messages, subjects, or senders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={messageTypeFilter} onValueChange={setMessageTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="quick">Quick Updates</SelectItem>
                <SelectItem value="urgent">Urgent Updates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="inbox">
                Inbox
                {getUnreadCount() > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {getUnreadCount()}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
            </TabsList>

            <TabsContent value="inbox" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inbox</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredMessages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Inbox className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No messages in your inbox</p>
                      <p className="text-sm">New messages will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredMessages.map((message) => (
                        <MessageCard
                          key={message.id}
                          message={message}
                          currentUserId={user?.id}
                          senderName={getSenderName(message.senderId)}
                          isRead={isMessageRead(message)}
                          onView={() => handleViewMessage(message)}
                          onReply={() => handleReplyMessage(message)}
                          onDelete={() => handleDeleteMessage(message.id)}
                          showActions={true}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sent" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sent Messages</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredMessages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Send className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No sent messages</p>
                      <p className="text-sm">Messages you send will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredMessages.map((message) => (
                        <MessageCard
                          key={message.id}
                          message={message}
                          currentUserId={user?.id}
                          senderName={getSenderName(message.senderId)}
                          isRead={true}
                          onView={() => handleViewMessage(message)}
                          onDelete={() => handleDeleteMessage(message.id)}
                          showActions={false}
                          isSentView={true}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Modals */}
          <ComposeMessageModal
            isOpen={isComposeModalOpen}
            onClose={() => setIsComposeModalOpen(false)}
            users={users}
          />

          {selectedMessage && (
            <>
              <ViewMessageModal
                isOpen={isViewModalOpen}
                onClose={() => {
                  setIsViewModalOpen(false);
                  setSelectedMessage(null);
                }}
                message={selectedMessage}
                senderName={getSenderName(selectedMessage.senderId)}
                onReply={() => {
                  setIsViewModalOpen(false);
                  setIsReplyModalOpen(true);
                }}
              />

              <ReplyModal
                isOpen={isReplyModalOpen}
                onClose={() => {
                  setIsReplyModalOpen(false);
                  setSelectedMessage(null);
                }}
                originalMessage={selectedMessage}
                users={users}
              />
            </>
          )}
    </div>
  );
}