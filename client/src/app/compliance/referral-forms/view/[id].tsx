/**
 * Individual Referral View Page
 * Displays detailed view of a submitted referral form
 */

import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, User, Calendar, Phone, Mail, FileText, DollarSign, Heart, Activity } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

// Referral form interface (matches backend structure)
interface ReferralForm {
  id: string;
  tenantId: number;
  linkId: number;
  dateOfReferral: string;
  clientStatus: "New" | "Returning";
  
  // Referrer information
  referrerName: string;
  referrerOrg?: string;
  referrerPosition?: string;
  referrerPhoneEmail?: string;
  
  // Participant details
  clientName: string;
  clientDOB?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  
  // NDIS details
  ndisNumber?: string;
  planStart?: string;
  planEnd?: string;
  fundManagementType?: "NDIA" | "Self" | "Plan";
  
  // Fund Details
  coreCurrentBalance?: string;
  coreFundedAmount?: string;
  silCurrentBalance?: string;
  silFundedAmount?: string;
  otherCurrentBalance?: string;
  otherFundedAmount?: string;
  
  // Invoice details
  invoiceName?: string;
  invoiceEmail?: string;
  invoicePhone?: string;
  invoiceAddress?: string;
  
  // Health and support details
  currentSupports?: string;
  supportGoals?: string;
  medicalInformation?: string;
  medications?: string;
  behaviours?: Array<{
    behaviour: string;
    description?: string;
    howItPresents?: string;
    trigger?: string;
    managementStrategy?: string;
  }>;
  
  // Metadata
  submittedAt: string;
  status?: string;
  assessment?: any;
}

export default function ReferralViewPage() {
  const [match, params] = useRoute("/compliance/referral-forms/view/:id");
  const referralId = params?.id;

  const { data: referral, isLoading, error } = useQuery<ReferralForm>({
    queryKey: ["/api/referrals", referralId],
    enabled: !!referralId,
  });

  if (!match || !referralId) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600">Invalid Request</h2>
            <p className="text-gray-600 mt-2">No referral ID provided.</p>
            <Link href="/compliance/referral-forms">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Referrals
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600">Loading referral...</div>
        </div>
      </div>
    );
  }

  if (error || !referral) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600">Referral Not Found</h2>
            <p className="text-gray-600 mt-2">
              The requested referral could not be found or you don't have permission to view it.
            </p>
            <Link href="/compliance/referral-forms">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Referrals
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColor = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    approved: "bg-green-100 text-green-800 border-green-300",
    declined: "bg-red-100 text-red-800 border-red-300",
    "under-review": "bg-blue-100 text-blue-800 border-blue-300"
  };

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/compliance/referral-forms">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Referral Details</h1>
              <p className="text-muted-foreground">
                Submitted {format(new Date(referral.submittedAt), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {referral.status && (
              <Badge 
                variant="outline" 
                className={cn("capitalize", statusColor[referral.status as keyof typeof statusColor])}
              >
                {referral.status.replace('-', ' ')}
              </Badge>
            )}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date of Referral</label>
                <p className="font-medium">{format(new Date(referral.dateOfReferral), "MMMM d, yyyy")}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Client Status</label>
                <Badge variant="outline" className="ml-2">{referral.clientStatus}</Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Participant Name</label>
                <p className="font-medium">{referral.clientName}</p>
              </div>
              {referral.clientDOB && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p className="font-medium">{format(new Date(referral.clientDOB), "MMMM d, yyyy")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Referrer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Referrer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Referrer Name</label>
                <p className="font-medium">{referral.referrerName}</p>
              </div>
              {referral.referrerOrg && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Organization</label>
                  <p className="font-medium">{referral.referrerOrg}</p>
                </div>
              )}
              {referral.referrerPosition && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Position</label>
                  <p className="font-medium">{referral.referrerPosition}</p>
                </div>
              )}
              {referral.referrerPhoneEmail && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contact</label>
                  <p className="font-medium">{referral.referrerPhoneEmail}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Details */}
        {(referral.clientAddress || referral.clientPhone || referral.clientEmail) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referral.clientAddress && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="font-medium">{referral.clientAddress}</p>
                  </div>
                )}
                {referral.clientPhone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="font-medium">{referral.clientPhone}</p>
                  </div>
                )}
                {referral.clientEmail && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="font-medium">{referral.clientEmail}</p>
                  </div>
                )}
                {referral.emergencyContact && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Emergency Contact</label>
                    <p className="font-medium">{referral.emergencyContact}</p>
                    {referral.emergencyPhone && (
                      <p className="text-sm text-muted-foreground">{referral.emergencyPhone}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* NDIS Details */}
        {(referral.ndisNumber || referral.planStart || referral.fundManagementType) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                NDIS Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referral.ndisNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">NDIS Number</label>
                    <p className="font-medium">{referral.ndisNumber}</p>
                  </div>
                )}
                {referral.fundManagementType && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fund Management</label>
                    <Badge variant="outline">{referral.fundManagementType}</Badge>
                  </div>
                )}
                {referral.planStart && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Plan Start</label>
                    <p className="font-medium">{format(new Date(referral.planStart), "MMMM d, yyyy")}</p>
                  </div>
                )}
                {referral.planEnd && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Plan End</label>
                    <p className="font-medium">{format(new Date(referral.planEnd), "MMMM d, yyyy")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fund Details */}
        {(referral.coreCurrentBalance || referral.silCurrentBalance || referral.otherCurrentBalance) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Fund Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Core Supports */}
                {(referral.coreCurrentBalance || referral.coreFundedAmount) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Core Supports</h4>
                    {referral.coreFundedAmount && (
                      <div>
                        <label className="text-xs text-muted-foreground">Funded Amount</label>
                        <p className="font-medium">${referral.coreFundedAmount}</p>
                      </div>
                    )}
                    {referral.coreCurrentBalance && (
                      <div>
                        <label className="text-xs text-muted-foreground">Current Balance</label>
                        <p className="font-medium">${referral.coreCurrentBalance}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* SIL Supports */}
                {(referral.silCurrentBalance || referral.silFundedAmount) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">SIL Supports</h4>
                    {referral.silFundedAmount && (
                      <div>
                        <label className="text-xs text-muted-foreground">Funded Amount</label>
                        <p className="font-medium">${referral.silFundedAmount}</p>
                      </div>
                    )}
                    {referral.silCurrentBalance && (
                      <div>
                        <label className="text-xs text-muted-foreground">Current Balance</label>
                        <p className="font-medium">${referral.silCurrentBalance}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Other Supports */}
                {(referral.otherCurrentBalance || referral.otherFundedAmount) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Other Supports</h4>
                    {referral.otherFundedAmount && (
                      <div>
                        <label className="text-xs text-muted-foreground">Funded Amount</label>
                        <p className="font-medium">${referral.otherFundedAmount}</p>
                      </div>
                    )}
                    {referral.otherCurrentBalance && (
                      <div>
                        <label className="text-xs text-muted-foreground">Current Balance</label>
                        <p className="font-medium">${referral.otherCurrentBalance}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support Information */}
        {(referral.currentSupports || referral.supportGoals) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="h-5 w-5 mr-2" />
                Support Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {referral.currentSupports && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Supports</label>
                  <p className="mt-1">{referral.currentSupports}</p>
                </div>
              )}
              {referral.supportGoals && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Support Goals</label>
                  <p className="mt-1">{referral.supportGoals}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Health Information */}
        {(referral.medicalInformation || referral.medications || referral.behaviours?.length) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Health Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {referral.medicalInformation && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Medical Information</label>
                  <p className="mt-1">{referral.medicalInformation}</p>
                </div>
              )}
              {referral.medications && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Medications</label>
                  <p className="mt-1">{referral.medications}</p>
                </div>
              )}
              {referral.behaviours && referral.behaviours.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Behaviours of Concern</label>
                  <div className="mt-2 space-y-3">
                    {referral.behaviours.map((behaviour, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <h5 className="font-medium">{behaviour.behaviour}</h5>
                        {behaviour.description && (
                          <p className="text-sm text-muted-foreground mt-1">{behaviour.description}</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                          {behaviour.howItPresents && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">How it Presents</label>
                              <p className="text-sm">{behaviour.howItPresents}</p>
                            </div>
                          )}
                          {behaviour.trigger && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Triggers</label>
                              <p className="text-sm">{behaviour.trigger}</p>
                            </div>
                          )}
                          {behaviour.managementStrategy && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Management Strategy</label>
                              <p className="text-sm">{behaviour.managementStrategy}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice Details */}
        {(referral.invoiceName || referral.invoiceEmail || referral.invoiceAddress) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referral.invoiceName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Invoice Name</label>
                    <p className="font-medium">{referral.invoiceName}</p>
                  </div>
                )}
                {referral.invoiceEmail && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Invoice Email</label>
                    <p className="font-medium">{referral.invoiceEmail}</p>
                  </div>
                )}
                {referral.invoicePhone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Invoice Phone</label>
                    <p className="font-medium">{referral.invoicePhone}</p>
                  </div>
                )}
                {referral.invoiceAddress && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Invoice Address</label>
                    <p className="font-medium">{referral.invoiceAddress}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assessment (if available) */}
        {referral.assessment && (
          <Card>
            <CardHeader>
              <CardTitle>Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Decision</label>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "ml-2 capitalize",
                      referral.assessment.decision === "proceed" ? "text-green-600 border-green-600" :
                      referral.assessment.decision === "decline" ? "text-red-600 border-red-600" :
                      "text-blue-600 border-blue-600"
                    )}
                  >
                    {referral.assessment.decision}
                  </Badge>
                </div>
                {referral.assessment.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                    <p className="mt-1">{referral.assessment.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}