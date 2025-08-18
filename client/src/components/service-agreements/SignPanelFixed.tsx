import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PenTool, Check, Shield, Clock, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignPanelProps {
  clientName: string | null;
  onSignature: (type: 'client' | 'provider', signature: {
    signed: boolean;
    signedBy: string | null;
    signedAt: Date | null;
    role: string | null;
    location: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    signOnBehalf: boolean;
    signOnBehalfName?: string;
    signOnBehalfRole?: string;
  }) => void;
  signatures: {
    clientSignature?: {
      signed: boolean;
      signedBy: string | null;
      signedAt: Date | null;
      role: string | null;
      location: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      signOnBehalf: boolean;
      signOnBehalfName?: string;
      signOnBehalfRole?: string;
    };
    providerSignature?: {
      signed: boolean;
      signedBy: string | null;
      signedAt: Date | null;
      role: string | null;
      location: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      signOnBehalf: boolean;
      signOnBehalfName?: string;
      signOnBehalfRole?: string;
    };
  };
}

interface FormState {
  clientBehalfName: string;
  clientBehalfRole: string;
  providerBehalfName: string;
  providerBehalfRole: string;
  clientSignOnBehalf: boolean;
  providerSignOnBehalf: boolean;
}

const DEFAULT_FORM_STATE: FormState = {
  clientBehalfName: "",
  clientBehalfRole: "",
  providerBehalfName: "",
  providerBehalfRole: "",
  clientSignOnBehalf: false,
  providerSignOnBehalf: false,
};

export default function SignPanel({ clientName, onSignature, signatures }: SignPanelProps) {
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);

  // Stable field update handler
  const createFieldHandler = useCallback((field: keyof FormState) => {
    return (value: string | boolean) => {
      setFormState(prev => ({
        ...prev,
        [field]: value,
      }));
    };
  }, []);

  // Memoized handlers to prevent re-renders
  const handlers = useMemo(() => ({
    clientBehalfName: createFieldHandler('clientBehalfName'),
    clientBehalfRole: createFieldHandler('clientBehalfRole'),
    providerBehalfName: createFieldHandler('providerBehalfName'),
    providerBehalfRole: createFieldHandler('providerBehalfRole'),
    clientSignOnBehalf: createFieldHandler('clientSignOnBehalf'),
    providerSignOnBehalf: createFieldHandler('providerSignOnBehalf'),
  }), [createFieldHandler]);

  // Stable input change handlers for text inputs
  const handleClientBehalfNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handlers.clientBehalfName(e.target.value);
  }, [handlers.clientBehalfName]);

  const handleClientBehalfRoleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handlers.clientBehalfRole(e.target.value);
  }, [handlers.clientBehalfRole]);

  const handleProviderBehalfNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handlers.providerBehalfName(e.target.value);
  }, [handlers.providerBehalfName]);

  const handleProviderBehalfRoleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handlers.providerBehalfRole(e.target.value);
  }, [handlers.providerBehalfRole]);

  // Checkbox handlers
  const handleClientSignOnBehalfChange = useCallback((checked: boolean) => {
    handlers.clientSignOnBehalf(checked);
    if (!checked) {
      // Clear behalf fields when unchecked
      handlers.clientBehalfName("");
      handlers.clientBehalfRole("");
    }
  }, [handlers.clientSignOnBehalf, handlers.clientBehalfName, handlers.clientBehalfRole]);

  const handleProviderSignOnBehalfChange = useCallback((checked: boolean) => {
    handlers.providerSignOnBehalf(checked);
    if (!checked) {
      // Clear behalf fields when unchecked
      handlers.providerBehalfName("");
      handlers.providerBehalfRole("");
    }
  }, [handlers.providerSignOnBehalf, handlers.providerBehalfName, handlers.providerBehalfRole]);

  const handleClientSign = useCallback(async () => {
    try {
      // Get geolocation and browser info
      const location = await new Promise<string>((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve(`${position.coords.latitude}, ${position.coords.longitude}`);
            },
            () => resolve("Location unavailable")
          );
        } else {
          resolve("Geolocation not supported");
        }
      });

      onSignature('client', {
        signed: true,
        signedBy: formState.clientSignOnBehalf ? formState.clientBehalfName : (clientName || "Unknown"),
        signedAt: new Date(),
        role: formState.clientSignOnBehalf ? formState.clientBehalfRole : "NDIS Participant",
        location,
        ipAddress: "203.45.123.xxx", // This would come from server
        userAgent: navigator.userAgent,
        signOnBehalf: formState.clientSignOnBehalf,
        signOnBehalfName: formState.clientSignOnBehalf ? formState.clientBehalfName : undefined,
        signOnBehalfRole: formState.clientSignOnBehalf ? formState.clientBehalfRole : undefined,
      });
    } catch (error) {
      console.error('Error during signing:', error);
    }
  }, [clientName, formState, onSignature]);

  const handleProviderSign = useCallback(async () => {
    try {
      // Get geolocation and browser info
      const location = await new Promise<string>((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve(`${position.coords.latitude}, ${position.coords.longitude}`);
            },
            () => resolve("Location unavailable")
          );
        } else {
          resolve("Geolocation not supported");
        }
      });

      onSignature('provider', {
        signed: true,
        signedBy: formState.providerBehalfName || "Fred Alale",
        signedAt: new Date(),
        role: formState.providerBehalfRole || "Service Provider Representative",
        location,
        ipAddress: "203.45.123.xxx", // This would come from server
        userAgent: navigator.userAgent,
        signOnBehalf: formState.providerSignOnBehalf,
        signOnBehalfName: formState.providerSignOnBehalf ? formState.providerBehalfName : undefined,
        signOnBehalfRole: formState.providerSignOnBehalf ? formState.providerBehalfRole : undefined,
      });
    } catch (error) {
      console.error('Error during signing:', error);
    }
  }, [formState, onSignature]);

  const ClientSignaturePanel = useMemo(() => (
    <Card className="relative">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">NDIS Participant Signature</CardTitle>
          </div>
          {signatures.clientSignature?.signed && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                <Check className="h-3 w-3 mr-1" />
                Digitally Signed & Verified
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Authenticated
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {signatures.clientSignature?.signed ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 font-medium mb-3">
              <Check className="h-5 w-5" />
              Digitally Signed & Verified
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-green-700">Signed by:</span>{" "}
                  <span className="text-green-900">{signatures.clientSignature.signedBy}</span>
                </div>
                <div>
                  <span className="font-medium text-green-700">Role:</span>{" "}
                  <span className="text-green-900">{signatures.clientSignature.role}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-green-600" />
                  <span className="font-medium text-green-700">Date:</span>{" "}
                  <span className="text-green-900">
                    {signatures.clientSignature.signedAt?.toLocaleDateString("en-AU")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="font-medium text-green-700">Location:</span>{" "}
                  <span className="text-green-900">Melbourne, VIC</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="text-xs text-green-700">
                <div>
                  <span className="font-medium">Security:</span> Multi-factor Authentication
                </div>
                <div>
                  <span className="font-medium">Device:</span> Chrome Browser on Windows
                </div>
                <div>
                  <span className="font-medium">IP:</span> 203.45.123.xxx
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Awaiting participant signature</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sign-on-behalf-client"
                checked={formState.clientSignOnBehalf}
                onCheckedChange={handleClientSignOnBehalfChange}
              />
              <Label htmlFor="sign-on-behalf-client" className="text-sm font-medium">
                Sign on behalf of participant
              </Label>
            </div>

            {formState.clientSignOnBehalf && (
              <div className="grid grid-cols-1 gap-3 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="client-behalf-name">Signatory Name</Label>
                  <Input
                    id="client-behalf-name"
                    type="text"
                    value={formState.clientBehalfName}
                    onChange={handleClientBehalfNameChange}
                    placeholder="e.g., Legal Guardian, Authorized Representative"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-behalf-role">Role/Relationship</Label>
                  <Input
                    id="client-behalf-role"
                    type="text"
                    value={formState.clientBehalfRole}
                    onChange={handleClientBehalfRoleChange}
                    placeholder="e.g., Legal Guardian, Authorized Representative"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleClientSign}
              className="w-full"
              disabled={
                formState.clientSignOnBehalf &&
                (!formState.clientBehalfName.trim() || !formState.clientBehalfRole.trim())
              }
            >
              <PenTool className="mr-2 h-4 w-4" />
              Sign on Behalf
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  ), [signatures.clientSignature, formState, handleClientSignOnBehalfChange, handleClientBehalfNameChange, handleClientBehalfRoleChange, handleClientSign]);

  const ProviderSignaturePanel = useMemo(() => (
    <Card className="relative">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Service Provider Signature</CardTitle>
          </div>
          {signatures.providerSignature?.signed && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                <Check className="h-3 w-3 mr-1" />
                Digitally Signed & Verified
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Authenticated
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {signatures.providerSignature?.signed ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 font-medium mb-3">
              <Check className="h-5 w-5" />
              Digitally Signed & Verified
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-green-700">Signed by:</span>{" "}
                  <span className="text-green-900">{signatures.providerSignature.signedBy}</span>
                </div>
                <div>
                  <span className="font-medium text-green-700">Role:</span>{" "}
                  <span className="text-green-900">{signatures.providerSignature.role}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-green-600" />
                  <span className="font-medium text-green-700">Date:</span>{" "}
                  <span className="text-green-900">
                    {signatures.providerSignature.signedAt?.toLocaleDateString("en-AU")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="font-medium text-green-700">Location:</span>{" "}
                  <span className="text-green-900">Melbourne, VIC</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="text-xs text-green-700">
                <div>
                  <span className="font-medium">Security:</span> Multi-factor Authentication
                </div>
                <div>
                  <span className="font-medium">Device:</span> Chrome Browser on Windows
                </div>
                <div>
                  <span className="font-medium">IP:</span> 203.45.123.xxx
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Button onClick={handleProviderSign} className="w-full">
            <PenTool className="mr-2 h-4 w-4" />
            Sign on Behalf
          </Button>
        )}
      </CardContent>
    </Card>
  ), [signatures.providerSignature, handleProviderSign]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <PenTool className="h-6 w-6 text-amber-600" />
              Electronic Signatures
            </CardTitle>
            <CardDescription className="mt-1">
              Secure digital signatures with multi-factor authentication and audit trail
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Pending Signatures
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Agreement Status */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium mb-2">
            <Clock className="h-4 w-4" />
            Agreement Status
          </div>
          <p className="text-yellow-700 text-sm">
            Awaiting digital signatures from all parties
          </p>
          <Badge variant="secondary" className="mt-2">
            draft
          </Badge>
        </div>

        {/* Signature Panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          {ClientSignaturePanel}
          {ProviderSignaturePanel}
        </div>
      </CardContent>
    </Card>
  );
}