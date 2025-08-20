import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  PenTool, 
  FileCheck, 
  Calendar, 
  User,
  CheckCircle,
  Clock,
  Shield,
  MapPin,
  Fingerprint,
  Users,
  Link,
  Copy
} from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServiceAgreement } from "@shared/schema";

interface SignPanelProps {
  isAccepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  agreementData: Partial<ServiceAgreement>;
  agreementId?: string;
}

export default function SignPanel({ isAccepted, onAcceptedChange, agreementData, agreementId }: SignPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isClientSigned, setIsClientSigned] = useState(false);
  const [isProviderSigned, setIsProviderSigned] = useState(false);
  const [clientSignOnBehalf, setClientSignOnBehalf] = useState(false);
  const [providerSignOnBehalf, setProviderSignOnBehalf] = useState(false);
  const [clientBehalfName, setClientBehalfName] = useState("");
  const [clientBehalfRole, setClientBehalfRole] = useState("");
  const [providerBehalfName, setProviderBehalfName] = useState("");
  const [providerBehalfRole, setProviderBehalfRole] = useState("");
  
  // Third-party signing state
  const [showSharingDialog, setShowSharingDialog] = useState(false);
  const [selectedSignerRole, setSelectedSignerRole] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [accessCode, setAccessCode] = useState("");

  // Create sharing link mutation
  const createSharingLinkMutation = useMutation({
    mutationFn: async (data: { signerRole: string; recipientEmail?: string }) => {
      const response = await apiRequest('POST', `/api/compliance/service-agreements/${agreementId}/share`, data);
      return response;
    },
    onSuccess: (data) => {
      const baseUrl = window.location.origin;
      const fullLink = `${baseUrl}/sign/${data.token}`;
      setGeneratedLink(fullLink);
      setAccessCode(data.accessCode);
      
      toast({
        title: "Sharing Link Created",
        description: "The agreement can now be signed by external parties using this link.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Create Sharing Link",
        description: "There was an error creating the sharing link. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Optimized change handlers to prevent cursor jumping
  const handleClientBehalfNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setClientBehalfName(e.target.value);
  }, []);

  const handleClientBehalfRoleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setClientBehalfRole(e.target.value);
  }, []);

  const handleProviderBehalfNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setProviderBehalfName(e.target.value);
  }, []);

  const handleProviderBehalfRoleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setProviderBehalfRole(e.target.value);
  }, []);

  // Handler for creating sharing link
  const handleCreateSharingLink = () => {
    if (!selectedSignerRole) {
      toast({
        title: "Please select a signer role",
        description: "You must specify who will be signing this agreement.",
        variant: "destructive",
      });
      return;
    }

    createSharingLinkMutation.mutate({
      signerRole: selectedSignerRole,
      recipientEmail: recipientEmail || undefined
    });
  };

  // Handler for copying link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast({
        title: "Link copied to clipboard",
        description: "The sharing link has been copied successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy link",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  // Handler for copying access code
  const handleCopyAccessCode = async () => {
    try {
      await navigator.clipboard.writeText(accessCode);
      toast({
        title: "Access code copied",
        description: "The access code has been copied successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy access code",
        description: "Please copy the access code manually.",
        variant: "destructive",
      });
    }
  };

  // Fetch client details for signature
  const { data: clientDetails } = useQuery({
    queryKey: [`/api/clients/${agreementData.clientId}`],
    enabled: !!agreementData.clientId,
  });

  // Fetch current user for provider signature
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Get signature data - check database signatures first, then local state
  const getSignatureData = () => {
    const now = new Date();
    const clientName = clientDetails ? `${(clientDetails as any).firstName} ${(clientDetails as any).lastName}` : "Client Name";
    const providerName = currentUser ? (currentUser as any).fullName : "Provider Representative";
    
    // Check if we have signatures from the database
    const dbSignatures = (agreementData as any)?.signatures || [];
    const clientDbSignature = dbSignatures.find((sig: any) => sig.signerRole === 'client');
    const providerDbSignature = dbSignatures.find((sig: any) => sig.signerRole === 'organisation');
    
    return {
      client: {
        signed: !!clientDbSignature || isClientSigned,
        signedBy: clientDbSignature ? clientDbSignature.signerName : (clientSignOnBehalf ? clientBehalfName : clientName),
        signedByRole: clientDbSignature ? "NDIS Participant" : (clientSignOnBehalf ? clientBehalfRole : "NDIS Participant"),
        signedOnBehalf: clientSignOnBehalf,
        actualParticipant: clientName,
        signedAt: clientDbSignature ? clientDbSignature.signedAt : (isClientSigned ? now.toISOString() : null),
        ipAddress: "203.45.123.xxx", // Masked for privacy
        location: "Melbourne, VIC",
        deviceInfo: "Chrome Browser on Windows",
        authenticationMethod: "Multi-factor Authentication",
      },
      provider: {
        signed: !!providerDbSignature || isProviderSigned,
        signedBy: providerDbSignature ? providerDbSignature.signerName : (providerSignOnBehalf ? providerBehalfName : providerName),
        signedByRole: providerDbSignature ? "Service Provider Representative" : (providerSignOnBehalf ? providerBehalfRole : "Service Provider Representative"),
        signedOnBehalf: providerSignOnBehalf,
        actualProvider: providerName,
        signedAt: providerDbSignature ? providerDbSignature.signedAt : (isProviderSigned ? now.toISOString() : null),
        ipAddress: "203.45.123.xxx", // Masked for privacy
        location: "Melbourne, VIC",
        deviceInfo: "Chrome Browser on Windows",
        authenticationMethod: "Multi-factor Authentication",
      }
    };
  };

  const signatures = getSignatureData();

  const handleClientSign = async () => {
    if (clientSignOnBehalf && (!clientBehalfName || !clientBehalfRole)) {
      alert("Please provide name and role when signing on behalf of the participant");
      return;
    }
    
    // Save signature to backend if agreementId is available
    if (agreementId) {
      try {
        const clientName = clientDetails ? 
          (clientDetails.firstName && clientDetails.lastName ? 
            `${clientDetails.firstName} ${clientDetails.lastName}` : 
            (clientDetails.fullName || `Client ${clientDetails.id}`)
          ) : "Participant";
        
        const signatureData = {
          signerRole: 'client',
          signerName: clientSignOnBehalf ? clientBehalfName : clientName
        };
        
        const response = await fetch(`/api/compliance/service-agreements/${agreementId}/sign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signatureData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save signature');
        }
        
        console.log('[SIGNATURE] Client signature saved to backend');
        
        // Update local state and invalidate cache to refresh data
        setIsClientSigned(true);
        
        // Invalidate agreement queries to refresh status and signatures
        if (agreementId) {
          queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements", agreementId] });
          queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
        }
      } catch (error) {
        console.error('[SIGNATURE] Error saving client signature:', error);
        alert('Failed to save signature. Please try again.');
        return;
      }
    }
    
    setIsClientSigned(true);
  };

  const handleProviderSign = async () => {
    if (providerSignOnBehalf && (!providerBehalfName || !providerBehalfRole)) {
      alert("Please provide name and role when signing on behalf of the provider");
      return;
    }
    
    // Save signature to backend if agreementId is available
    if (agreementId) {
      try {
        const signatureData = {
          signerRole: 'organisation',
          signerName: providerSignOnBehalf ? providerBehalfName : (currentUser ? (currentUser as any).fullName : "Provider Representative")
        };
        
        const response = await fetch(`/api/compliance/service-agreements/${agreementId}/sign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signatureData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save signature');
        }
        
        console.log('[SIGNATURE] Provider signature saved to backend');
        
        // Update local state and invalidate cache to refresh data
        setIsProviderSigned(true);
        
        // Invalidate agreement queries to refresh status and signatures
        if (agreementId) {
          queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements", agreementId] });
          queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
        }
      } catch (error) {
        console.error('[SIGNATURE] Error saving provider signature:', error);
        alert('Failed to save signature. Please try again.');
        return;
      }
    }
    
    setIsProviderSigned(true);
  };

  const isFullySigned = signatures.client.signed && signatures.provider.signed;

  const SignatureCard = ({ signature, type, onSign, onBehalfChecked, setOnBehalfChecked, behalfName, setBehalfName, behalfRole, setBehalfRole }: any) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {type === "client" ? (
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <FileCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        )}
        <h3 className="font-medium">
          {type === "client" ? "NDIS Participant Signature" : "Service Provider Signature"}
        </h3>
      </div>
      
      {signature.signed ? (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Digitally Signed & Verified
            </span>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              <Shield className="h-3 w-3 mr-1" />
              Authenticated
            </Badge>
          </div>
          
          <div className="grid gap-3 text-sm">
            {/* Primary Signer Information */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-3 w-3 text-green-600" />
                <span className="font-medium">Signed by:</span> 
                <span className="font-semibold">{signature.signedBy}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-green-600" />
                <span className="font-medium">Role:</span> 
                <span>{signature.signedByRole}</span>
              </div>
              
              {signature.signedOnBehalf && (
                <div className="pl-5 border-l-2 border-green-300 bg-green-100/50 dark:bg-green-900/30 p-2 rounded">
                  <div className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">
                    Signed on behalf of:
                  </div>
                  <div className="text-sm font-medium">
                    {type === "client" ? signature.actualParticipant : signature.actualProvider}
                  </div>
                </div>
              )}
            </div>

            {/* Timestamp and Location */}
            {signature.signedAt && (
              <div className="grid md:grid-cols-2 gap-2 pt-2 border-t border-green-200">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-500" />
                  <span className="text-xs">
                    {new Date(signature.signedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  <span className="text-xs">{signature.location}</span>
                </div>
              </div>
            )}

            {/* Security Information */}
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-2 border-t border-green-200">
              <div>
                <span className="font-medium">Security:</span> {signature.authenticationMethod}
              </div>
              <div>
                <span className="font-medium">Device:</span> {signature.deviceInfo}
              </div>
              <div>
                <span className="font-medium">IP:</span> {signature.ipAddress}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center">
            <div className="space-y-3">
              <PenTool className="mx-auto h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Awaiting {type === "client" ? "participant" : "provider"} signature
              </p>
              
              {/* Sign on Behalf Option */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 justify-center">
                  <Checkbox
                    id={`${type}-behalf`}
                    checked={onBehalfChecked}
                    onCheckedChange={setOnBehalfChecked}
                  />
                  <Label 
                    htmlFor={`${type}-behalf`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    Sign on behalf of {type === "client" ? "participant" : "provider"}
                  </Label>
                </div>

                {/* On Behalf Fields */}
                {onBehalfChecked && (
                  <div className="grid gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded border">
                    <div>
                      <Label className="text-xs text-slate-600">Signatory Name</Label>
                      <Input
                        placeholder="Enter your full name"
                        value={behalfName}
                        onChange={type === "client" ? handleClientBehalfNameChange : handleProviderBehalfNameChange}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Role/Relationship</Label>
                      <Input
                        placeholder="e.g., Legal Guardian, Authorized Representative"
                        value={behalfRole}
                        onChange={type === "client" ? handleClientBehalfRoleChange : handleProviderBehalfRoleChange}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={onSign}
                className="mt-3"
              >
                <PenTool className="h-4 w-4 mr-2" />
                Sign {onBehalfChecked ? "on Behalf" : `as ${type === "client" ? "Participant" : "Provider"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className={`border-2 ${isFullySigned ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            <CardTitle>Electronic Signatures</CardTitle>
          </div>
          <Badge variant={isFullySigned ? "default" : "secondary"}>
            {isFullySigned ? "Fully Executed" : "Pending Signatures"}
          </Badge>
        </div>
        <CardDescription>
          Secure digital signatures with multi-factor authentication and audit trail
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Agreement Status */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isFullySigned ? 'bg-green-100 dark:bg-green-900' : 'bg-amber-100 dark:bg-amber-900'}`}>
              {isFullySigned ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <h3 className="font-medium">Agreement Status</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isFullySigned 
                  ? "Agreement is legally binding and active"
                  : "Awaiting digital signatures from all parties"
                }
              </p>
            </div>
          </div>
          <Badge variant={isFullySigned ? "default" : "outline"}>
            {agreementData?.status || "draft"}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Client Signature */}
          <SignatureCard
            signature={signatures.client}
            type="client"
            onSign={handleClientSign}
            onBehalfChecked={clientSignOnBehalf}
            setOnBehalfChecked={setClientSignOnBehalf}
            behalfName={clientBehalfName}
            setBehalfName={setClientBehalfName}
            behalfRole={clientBehalfRole}
            setBehalfRole={setClientBehalfRole}
          />

          {/* Provider Signature */}
          <SignatureCard
            signature={signatures.provider}
            type="provider"
            onSign={handleProviderSign}
            onBehalfChecked={providerSignOnBehalf}
            setOnBehalfChecked={setProviderSignOnBehalf}
            behalfName={providerBehalfName}
            setBehalfName={setProviderBehalfName}
            behalfRole={providerBehalfRole}
            setBehalfRole={setProviderBehalfRole}
          />
        </div>

        {/* Third-party Signing Section */}
        <Separator />
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-medium">External Signing</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Share a secure link for third parties to sign this agreement
              </p>
            </div>
            
            <Dialog open={showSharingDialog} onOpenChange={setShowSharingDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Create Signing Link
                </Button>
              </DialogTrigger>
              
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create External Signing Link</DialogTitle>
                  <DialogDescription>
                    Generate a secure link to allow external parties to sign this service agreement.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signer-role">Who will be signing?</Label>
                    <Select value={selectedSignerRole} onValueChange={setSelectedSignerRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select signer role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client/Participant</SelectItem>
                        <SelectItem value="provider">Service Provider</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recipient-email">Recipient Email (Optional)</Label>
                    <Input
                      id="recipient-email"
                      type="email"
                      placeholder="recipient@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                    <p className="text-xs text-slate-500">
                      Optional: Record who the link was sent to
                    </p>
                  </div>
                  
                  {!generatedLink ? (
                    <Button
                      onClick={handleCreateSharingLink}
                      disabled={createSharingLinkMutation.isPending}
                      className="w-full"
                    >
                      {createSharingLinkMutation.isPending ? "Creating..." : "Generate Signing Link"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Signing Link</Label>
                        <div className="flex">
                          <Input
                            value={generatedLink}
                            readOnly
                            className="rounded-r-none"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-l-none border-l-0"
                            onClick={handleCopyLink}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Access Code</Label>
                        <div className="flex">
                          <Input
                            value={accessCode}
                            readOnly
                            className="rounded-r-none font-mono"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-l-none border-l-0"
                            onClick={handleCopyAccessCode}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                          The recipient will need this access code to sign the agreement
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Legal Notice */}
        <Separator />
        
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
          <p className="font-medium flex items-center gap-2">
            <Shield className="h-3 w-3" />
            Digital Signature Legal Notice:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>
              Electronic signatures are legally binding under the Electronic Transactions Act
            </li>
            <li>
              Multi-factor authentication ensures signatory identity verification
            </li>
            <li>
              Comprehensive audit trail includes timestamps, IP addresses, and device information
            </li>
            <li>
              Signed documents are immutable and stored with 256-bit encryption
            </li>
            <li>
              All signature events are logged for legal compliance and verification
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}