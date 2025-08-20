import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  Lock, 
  MapPin, 
  Fingerprint,
  FileCheck,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublicSignPageProps {
  token: string;
}

export default function PublicSignPage() {
  const [match, params] = useRoute("/sign/:token");
  const { toast } = useToast();
  
  const [accessCode, setAccessCode] = useState("");
  const [verificationStep, setVerificationStep] = useState<"access_code" | "signing" | "completed">("access_code");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [onBehalfOf, setOnBehalfOf] = useState(false);
  const [onBehalfName, setOnBehalfName] = useState("");
  const [onBehalfRole, setOnBehalfRole] = useState("");

  const token = params?.token;

  // Query to verify access code and get agreement details
  const { data: agreementData, isLoading, error } = useQuery({
    queryKey: ['/api/sign/verify-access', token, accessCode],
    queryFn: async () => {
      const response = await fetch(`/api/sign/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accessCode })
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify access code');
      }
      
      return response.json();
    },
    enabled: !!token && !!accessCode && verificationStep === "access_code",
    retry: false
  });

  // Mutation to submit signature
  const signMutation = useMutation({
    mutationFn: async (signatureData: any) => {
      const response = await fetch(`/api/sign/submit-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: agreementData?.tokenId,
          signerName,
          signerEmail,
          onBehalfOf,
          onBehalfName: onBehalfOf ? onBehalfName : undefined,
          onBehalfRole: onBehalfOf ? onBehalfRole : undefined,
          signature: signatureData
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit signature');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setVerificationStep("completed");
      toast({
        title: "Signature Submitted Successfully",
        description: "Your signature has been recorded and the agreement is now signed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Signature Failed",
        description: error.message || "There was an error submitting your signature.",
        variant: "destructive",
      });
    }
  });

  // Handle access code verification
  const handleVerifyAccessCode = () => {
    if (!accessCode) {
      toast({
        title: "Access Code Required",
        description: "Please enter the access code provided to you.",
        variant: "destructive",
      });
      return;
    }
  };

  // Handle signature submission
  const handleSubmitSignature = () => {
    if (!signerName || !signerEmail) {
      toast({
        title: "Required Information Missing",
        description: "Please provide your name and email address.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Terms Not Accepted",
        description: "You must accept the terms and conditions to proceed.",
        variant: "destructive",
      });
      return;
    }

    if (onBehalfOf && (!onBehalfName || !onBehalfRole)) {
      toast({
        title: "Missing Information",
        description: "Please provide the name and role for the person you are signing on behalf of.",
        variant: "destructive",
      });
      return;
    }

    // Create signature data with timestamp and verification info
    const signatureData = {
      timestamp: new Date().toISOString(),
      signerName,
      signerEmail,
      ipAddress: 'recorded', // Server will capture actual IP
      userAgent: navigator.userAgent,
      onBehalfOf,
      onBehalfName: onBehalfOf ? onBehalfName : undefined,
      onBehalfRole: onBehalfOf ? onBehalfRole : undefined
    };

    signMutation.mutate(signatureData);
  };

  // Effect to proceed to signing step when agreement data is loaded
  useEffect(() => {
    if (agreementData && verificationStep === "access_code") {
      setVerificationStep("signing");
    }
  }, [agreementData, verificationStep]);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <h1 className="text-xl font-semibold">Invalid Link</h1>
              <p className="text-slate-600 dark:text-slate-400">
                This signing link is invalid or has expired.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Service Agreement Signing</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Secure digital signature portal
          </p>
        </div>

        {verificationStep === "access_code" && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Access Verification
              </CardTitle>
              <CardDescription>
                Enter the access code provided to you to view and sign the agreement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access-code">Access Code</Label>
                <Input
                  id="access-code"
                  type="text"
                  placeholder="Enter access code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Invalid access code. Please check and try again.
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={handleVerifyAccessCode}
                disabled={isLoading || !accessCode}
                className="w-full"
              >
                {isLoading ? "Verifying..." : "Verify Access Code"}
              </Button>
            </CardContent>
          </Card>
        )}

        {verificationStep === "signing" && agreementData && (
          <div className="space-y-6">
            {/* Agreement Details */}
            <Card>
              <CardHeader>
                <CardTitle>Service Agreement Details</CardTitle>
                <CardDescription>
                  Please review the agreement details before signing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium">Client Name</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {agreementData.clientName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Service Provider</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {agreementData.providerName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Agreement Type</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      NDIS Service Agreement
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Your Role</Label>
                    <Badge variant="outline">
                      {agreementData.signerRole === 'client' ? 'Client/Participant' : 'Service Provider'}
                    </Badge>
                  </div>
                </div>

                {agreementData.serviceItems && agreementData.serviceItems.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Service Items</Label>
                    <div className="mt-2 space-y-2">
                      {agreementData.serviceItems.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                          <div>
                            <p className="font-medium">{item.description}</p>
                            <p className="text-xs text-slate-500">Code: {item.ndisCode}</p>
                          </div>
                          <p className="text-sm font-medium">${item.unitPrice}/{item.unitType}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5" />
                  Digital Signature
                </CardTitle>
                <CardDescription>
                  Provide your information and consent to sign this agreement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="signer-name">Your Full Name *</Label>
                    <Input
                      id="signer-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signer-email">Your Email Address *</Label>
                    <Input
                      id="signer-email"
                      type="email"
                      placeholder="Enter your email address"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Sign on behalf of checkbox */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="on-behalf"
                      checked={onBehalfOf}
                      onCheckedChange={(checked) => setOnBehalfOf(checked === true)}
                    />
                    <Label 
                      htmlFor="on-behalf" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I am signing on behalf of another person
                    </Label>
                  </div>

                  {onBehalfOf && (
                    <div className="grid gap-4 md:grid-cols-2 ml-6">
                      <div className="space-y-2">
                        <Label htmlFor="behalf-name">Name of person you represent *</Label>
                        <Input
                          id="behalf-name"
                          type="text"
                          placeholder="Enter their full name"
                          value={onBehalfName}
                          onChange={(e) => setOnBehalfName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="behalf-role">Your relationship/role *</Label>
                        <Input
                          id="behalf-role"
                          type="text"
                          placeholder="e.g., Guardian, Power of Attorney, etc."
                          value={onBehalfRole}
                          onChange={(e) => setOnBehalfRole(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Terms acceptance */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                    />
                    <Label 
                      htmlFor="accept-terms" 
                      className="text-sm leading-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I acknowledge that I have read, understood, and agree to the terms and conditions 
                      of this service agreement. I understand that this electronic signature has the 
                      same legal effect as a handwritten signature.
                    </Label>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmitSignature}
                  disabled={signMutation.isPending || !acceptTerms}
                  className="w-full"
                  size="lg"
                >
                  {signMutation.isPending ? "Submitting Signature..." : "Sign Agreement"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {verificationStep === "completed" && (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold">Signature Completed</h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Thank you! Your signature has been successfully recorded and the 
                  service agreement is now fully executed.
                </p>
                <div className="text-xs text-slate-500 space-y-1">
                  <p className="flex items-center justify-center gap-1">
                    <Shield className="h-3 w-3" />
                    Your signature is legally binding and secured
                  </p>
                  <p className="flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    Timestamp: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 space-y-2">
          <p className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            Secured by 256-bit SSL encryption
          </p>
          <p>
            This signature process complies with electronic signature laws and regulations.
            All activities are logged for legal compliance and audit purposes.
          </p>
        </div>
      </div>
    </div>
  );
}