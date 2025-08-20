import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Check,
  Loader2
} from "lucide-react";

interface TermsViewerProps {
  customTerms: string;
  onCustomTermsChange: (terms: string) => void;
  isAccepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}

interface TermsTemplate {
  id: string;
  title: string;
  body: string;
  isDefault: boolean;
}

export default function TermsViewer({
  customTerms,
  onCustomTermsChange,
  isAccepted,
  onAcceptedChange,
}: TermsViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustomTerms, setShowCustomTerms] = useState(false);

  // Fetch terms template from API
  const { data: termsTemplate, isLoading: termsLoading } = useQuery<TermsTemplate>({
    queryKey: ["/api/terms-templates/default"],
    retry: false,
  });

  // Parse the terms content into sections
  const parseTermsContent = (body: string) => {
    if (!body) return [];
    
    // Split by section numbers (2., 3., etc.)
    const sections = body.split(/(?=\d+\.\s)/).filter(section => section.trim());
    
    return sections.map(section => {
      const lines = section.trim().split('\n').filter(line => line.trim());
      if (lines.length === 0) return null;
      
      // First line should be the title
      const titleMatch = lines[0].match(/^\d+\.\s*(.+)$/);
      const title = titleMatch ? titleMatch[1] : lines[0];
      
      // Rest are content
      const content = lines.slice(1).filter(line => line.trim());
      
      return {
        title,
        content: content.length > 0 ? content : [title]
      };
    }).filter((section): section is { title: string; content: string[] } => section !== null);
  };

  const standardTerms = termsTemplate ? parseTermsContent(termsTemplate.body) : [];

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
              <h3 className="font-medium">
                {termsTemplate?.title || "Standard NDIS Terms & Conditions"}
              </h3>
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
                  {termsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                      <span className="ml-2 text-slate-600">Loading terms...</span>
                    </div>
                  ) : termsTemplate ? (
                    <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-400">
                      <div className="whitespace-pre-wrap">{termsTemplate.body}</div>
                    </div>
                  ) : standardTerms.length > 0 ? (
                    standardTerms.map((section, index) => (
                      <div key={index} className="space-y-3">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100">
                          {section.title}
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
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      No terms template found. Please contact your administrator.
                    </div>
                  )}
                  
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
                {termsLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                    <span className="text-sm text-slate-600">Loading terms preview...</span>
                  </div>
                ) : termsTemplate ? (
                  <>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      This agreement includes comprehensive NDIS-compliant terms covering:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>Provider & Participant Responsibilities</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>Payment Terms & Billing</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>Cancellation Policies</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>Privacy & Information Sharing</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>Disaster & Emergency Management</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>Service Continuity & Handover</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>Agreement Termination</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span>GST & Compliance</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Total: {termsTemplate?.body ? Math.ceil(termsTemplate.body.length / 100) : 0} sections with detailed provisions
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Standard NDIS terms will be loaded automatically
                  </p>
                )}
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