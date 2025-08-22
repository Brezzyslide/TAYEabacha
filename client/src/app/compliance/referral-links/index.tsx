/**
 * NDIS Referral Links Management
 * Internal page for creating and managing public referral links
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, ExternalLink, Copy, Plus, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Form schema for creating new referral links
const CreateLinkSchema = z.object({
  expiresAt: z.date().optional(),
  maxUses: z.number().int().positive().optional(),
});

type CreateLinkData = z.infer<typeof CreateLinkSchema>;

interface ReferralLink {
  id: number;
  url: string;
  token: string;
  expiresAt: string | null;
  maxUses: number | null;
}

interface Referral {
  id: string;
  clientName: string;
  referrerName: string;
  submittedAt: string;
  status: string;
}

export default function ReferralLinksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<ReferralLink[]>([]);

  const form = useForm<CreateLinkData>({
    resolver: zodResolver(CreateLinkSchema),
    defaultValues: {},
  });

  // Fetch referral submissions with optimized caching
  const { data: referrals = [], isLoading: referralsLoading } = useQuery<Referral[]>({
    queryKey: ["/api/referrals"],
    staleTime: 30000, // Cache for 30 seconds for faster subsequent loads
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  // Create referral link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (data: CreateLinkData): Promise<ReferralLink> => {
      const response = await apiRequest("POST", "/api/referrals/links", data);
      return response.json();
    },
    onSuccess: (newLink: ReferralLink) => {
      setCreatedLinks(prev => [newLink, ...prev]);
      toast({
        title: "Referral Link Created",
        description: "Your referral link has been created successfully.",
      });
      setShowCreateForm(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create referral link",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: CreateLinkData) => {
    createLinkMutation.mutate(data);
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NDIS Referral Links</h1>
          <p className="text-muted-foreground">
            Create and manage public referral links for NDIS participant referrals
          </p>
        </div>
        
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create New Link
        </Button>
      </div>

      {/* Create Link Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Referral Link</CardTitle>
            <CardDescription>
              Generate a secure, shareable link for external parties to submit NDIS referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Expiration Date (Optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : "No expiration"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maxUses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Uses (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Unlimited" 
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createLinkMutation.isPending}
                  >
                    {createLinkMutation.isPending ? "Creating..." : "Create Link"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Created Referral Links */}
      {createdLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Created Referral Links</CardTitle>
            <CardDescription>
              Your generated referral links ready to share with external parties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {createdLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950"
                >
                  <div className="space-y-2 flex-1">
                    <div className="font-medium text-green-800 dark:text-green-200">
                      Referral Link #{link.id}
                    </div>
                    <div className="text-sm font-mono bg-white dark:bg-gray-800 p-2 rounded border break-all">
                      {link.url}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {link.expiresAt && (
                        <span>Expires: {format(new Date(link.expiresAt), "PPP")}</span>
                      )}
                      {link.maxUses && <span>Max uses: {link.maxUses}</span>}
                      {!link.expiresAt && !link.maxUses && <span>No restrictions</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(link.url, link.token)}
                      className="flex items-center gap-2"
                    >
                      {copiedToken === link.token ? (
                        <>
                          <Eye className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(link.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Alert className="mt-4">
              <AlertDescription>
                <strong>How to share:</strong> Copy the link above and send it to external parties (hospitals, doctors, coordinators) 
                who need to submit NDIS participant referrals. They can fill out the form without needing login credentials.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Recent Referral Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referral Submissions</CardTitle>
          <CardDescription>
            Latest referrals submitted through your public links
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referralsLoading ? (
            <div className="text-center py-8">Loading referrals...</div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No referrals received yet. Create a referral link to start receiving submissions.
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{referral.clientName}</div>
                    <div className="text-sm text-muted-foreground">
                      Referred by {referral.referrerName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(referral.submittedAt), "PPP p")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={referral.status === "pending" ? "secondary" : "default"}>
                      {referral.status}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Prefetch referral data for instant loading
                        queryClient.prefetchQuery({
                          queryKey: ["/api/referrals", referral.id],
                          queryFn: () => fetch(`/api/referrals/${referral.id}`).then(res => res.json()),
                          staleTime: 60000 // Keep fresh for 1 minute
                        });
                        // Navigate immediately with optimized routing
                        window.location.href = `/compliance/referral-management?referral=${referral.id}`;
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use Referral Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                Create Link
              </div>
              <p className="text-sm text-muted-foreground">
                Click "Create New Link" to generate a secure shareable link with optional expiration and usage limits.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                Share Link
              </div>
              <p className="text-sm text-muted-foreground">
                Copy and share the link with external parties who need to submit NDIS participant referrals.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                Receive Referrals
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor incoming referrals on this page and follow up with referrers as needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}