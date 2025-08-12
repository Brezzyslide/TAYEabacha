import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  PenTool, 
  FileCheck, 
  Calendar, 
  User,
  CheckCircle,
  Clock
} from "lucide-react";
import type { ServiceAgreement } from "@shared/schema";

interface SignPanelProps {
  isAccepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  agreementData: Partial<ServiceAgreement>;
}

export default function SignPanel({ isAccepted, onAcceptedChange, agreementData }: SignPanelProps) {
  const [isClientSigned, setIsClientSigned] = useState(false);
  const [isProviderSigned, setIsProviderSigned] = useState(false);

  // Mock signature data - in production, this would come from the agreement
  const signatures = {
    client: {
      signed: agreementData?.status === "active" || isClientSigned,
      signedBy: "Client Name", // Would come from client data
      signedAt: agreementData?.status === "active" ? new Date().toISOString() : null,
      ipAddress: "192.168.1.100",
    },
    provider: {
      signed: agreementData?.status === "active" || isProviderSigned,
      signedBy: "Provider Representative", // Would come from current user
      signedAt: agreementData?.status === "active" ? new Date().toISOString() : null,
      ipAddress: "192.168.1.100",
    }
  };

  const handleClientSign = () => {
    // In production, this would trigger a digital signature process
    setIsClientSigned(true);
  };

  const handleProviderSign = () => {
    // In production, this would trigger a digital signature process
    setIsProviderSigned(true);
  };

  const isFullySigned = signatures.client.signed && signatures.provider.signed;

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
          Digital signatures with timestamp and IP address tracking for legal compliance
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
            {agreement.status || "draft"}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Client Signature */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium">NDIS Participant Signature</h3>
            </div>
            
            {signatures.client.signed ? (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Digitally Signed
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <div>
                    <span className="font-medium">Signed by:</span> {signatures.client.signedBy}
                  </div>
                  {signatures.client.signedAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(signatures.client.signedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">IP:</span> {signatures.client.ipAddress}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center">
                <div className="space-y-2">
                  <PenTool className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Awaiting client signature
                  </p>
                  {mode === "edit" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClientSign}
                      className="mt-2"
                    >
                      Sign as Client
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Provider Signature */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-medium">Service Provider Signature</h3>
            </div>
            
            {signatures.provider.signed ? (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Digitally Signed
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <div>
                    <span className="font-medium">Signed by:</span> {signatures.provider.signedBy}
                  </div>
                  {signatures.provider.signedAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(signatures.provider.signedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">IP:</span> {signatures.provider.ipAddress}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center">
                <div className="space-y-2">
                  <PenTool className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Awaiting provider signature
                  </p>
                  {mode === "edit" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleProviderSign}
                      className="mt-2"
                    >
                      Sign as Provider
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legal Notice */}
        <Separator />
        
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
          <p className="font-medium">Digital Signature Legal Notice:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>
              Electronic signatures are legally binding under the Electronic Transactions Act
            </li>
            <li>
              Timestamps and IP addresses are recorded for verification purposes
            </li>
            <li>
              Both parties consent to electronic execution of this agreement
            </li>
            <li>
              Signed documents are immutable and stored securely
            </li>
          </ul>
        </div>

        {/* Signature Progress */}
        {!isFullySigned && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Signature Progress
              </span>
            </div>
            <div className="text-sm text-amber-600 dark:text-amber-400">
              {!signatures.client.signed && !signatures.provider.signed && "Waiting for both parties to sign"}
              {signatures.client.signed && !signatures.provider.signed && "Waiting for service provider signature"}
              {!signatures.client.signed && signatures.provider.signed && "Waiting for client signature"}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}