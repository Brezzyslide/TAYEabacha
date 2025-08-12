import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  FileText, 
  ChevronDown, 
  ChevronRight, 
  Shield, 
  AlertCircle,
  Check
} from "lucide-react";

interface TermsViewerProps {
  customTerms: string;
  onCustomTermsChange: (terms: string) => void;
  isAccepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}

export default function TermsViewer({
  customTerms,
  onCustomTermsChange,
  isAccepted,
  onAcceptedChange,
}: TermsViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustomTerms, setShowCustomTerms] = useState(false);

  // Standard NDIS terms and conditions
  const standardTerms = [
    {
      title: "Service Delivery Standards",
      content: [
        "All services will be delivered in accordance with NDIS Practice Standards and relevant legislation",
        "Support will be provided in a manner that promotes choice, control, and independence",
        "Services will be culturally appropriate and respectful of participant preferences",
        "Regular reviews will be conducted to ensure service quality and participant satisfaction"
      ]
    },
    {
      title: "Participant Rights and Responsibilities",
      content: [
        "Participants have the right to receive safe, quality supports and services",
        "Participants have the right to make informed choices about their supports",
        "Participants are responsible for providing accurate information about their needs",
        "Participants must give reasonable notice for changes or cancellations"
      ]
    },
    {
      title: "Provider Obligations",
      content: [
        "Maintain appropriate insurance coverage and professional registrations",
        "Comply with all NDIS requirements including the NDIS Code of Conduct",
        "Provide services as outlined in the participant's NDIS plan",
        "Report any incidents or safeguarding concerns as required by law"
      ]
    },
    {
      title: "Financial Terms",
      content: [
        "Services will be charged in accordance with NDIS Price Guide rates",
        "Invoices will be submitted monthly unless otherwise agreed",
        "Cancellation fees may apply for insufficient notice as per NDIS guidelines",
        "Any disputes regarding billing will be resolved through appropriate channels"
      ]
    },
    {
      title: "Privacy and Confidentiality",
      content: [
        "Personal information will be handled in accordance with Privacy Act 1988",
        "Information will only be shared with consent or as required by law",
        "Secure systems will be used for storing and transmitting personal data",
        "Participants have the right to access and correct their personal information"
      ]
    },
    {
      title: "Agreement Variation and Termination",
      content: [
        "This agreement may be varied by mutual consent of both parties",
        "Either party may terminate with 14 days written notice",
        "Immediate termination may occur for serious breaches or safety concerns",
        "Upon termination, final invoices and records transfer will be completed promptly"
      ]
    },
    {
      title: "Complaints and Disputes",
      content: [
        "Complaints should first be raised directly with the service provider",
        "If unresolved, complaints may be escalated to the NDIS Quality and Safeguards Commission",
        "Dispute resolution processes are available through appropriate channels",
        "Participants may access independent advocacy support if needed"
      ]
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Terms and Conditions</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustomTerms(!showCustomTerms)}
          >
            {showCustomTerms ? "Hide" : "Add"} Custom Terms
          </Button>
        </div>
        <CardDescription>
          Standard NDIS terms and conditions apply to this service agreement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Terms Section */}
        {showCustomTerms && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium">Additional Terms & Conditions</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customTerms">
                Tenant-specific terms (will be added to standard NDIS terms)
              </Label>
              <Textarea
                id="customTerms"
                value={customTerms}
                onChange={(e) => onCustomTermsChange(e.target.value)}
                placeholder="Enter any additional terms and conditions specific to your organization..."
                className="min-h-[120px]"
              />
              <p className="text-xs text-slate-500">
                These additional terms will appear after the standard NDIS terms in the final agreement
              </p>
            </div>
            <Separator />
          </div>
        )}

        {/* Standard Terms */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="font-medium">Standard NDIS Terms & Conditions</h3>
            </div>
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Expand Full Terms
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="space-y-6 max-h-96 overflow-y-auto border rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  {standardTerms.map((section, index) => (
                    <div key={index} className="space-y-3">
                      <h4 className="font-medium text-slate-900 dark:text-slate-100">
                        {index + 1}. {section.title}
                      </h4>
                      <ul className="space-y-2 ml-4">
                        {section.content.map((item, itemIndex) => (
                          <li key={itemIndex} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                            <span className="text-slate-400 mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      {index < standardTerms.length - 1 && <Separator />}
                    </div>
                  ))}
                  
                  {customTerms && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100">
                          {standardTerms.length + 1}. Additional Terms
                        </h4>
                        <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {customTerms}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {!isExpanded && (
            <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800">
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This agreement includes standard NDIS terms covering:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  {standardTerms.map((section, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      <span>{section.title}</span>
                    </div>
                  ))}
                </div>
                {customTerms && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <Check className="h-3 w-3" />
                    <span>Plus additional tenant-specific terms</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Terms Acceptance */}
        <div className="space-y-4">
          <Separator />
          <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex items-start gap-3">
              <Checkbox
                id="acceptTerms"
                checked={isAccepted}
                onCheckedChange={onAcceptedChange}
                className="mt-1"
              />
              <div className="space-y-2">
                <Label
                  htmlFor="acceptTerms"
                  className="text-sm font-medium leading-relaxed cursor-pointer"
                >
                  I acknowledge that I have read, understood, and agree to be bound by the terms and conditions outlined above, including all standard NDIS terms and any additional terms specified.
                </Label>
                <p className="text-xs text-slate-500">
                  By checking this box, both the NDIS participant (or their nominee) and the service provider agree to the terms of this service agreement. Digital signatures will be captured separately.
                </p>
              </div>
            </div>
          </div>
          
          {isAccepted && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Terms and conditions accepted</span>
            </div>
          )}
        </div>

        {/* Legal Footer */}
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-medium">Legal Notice:</p>
          <p>
            This agreement is governed by Australian law and NDIS regulations. 
            Both parties acknowledge their understanding of rights and obligations under the NDIS Act 2013.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}