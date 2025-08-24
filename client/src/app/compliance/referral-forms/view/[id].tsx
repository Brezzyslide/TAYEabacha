/**
 * Individual Referral View Page
 * Displays detailed view of a submitted referral form
 */

import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, User, Calendar, Phone, Mail, FileText, DollarSign, Heart, Activity, Star, Clock } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

// Referral form interface (matches actual backend structure)
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
  referrerContact?: string;
  
  // Participant details
  clientName: string;
  dob?: string;
  address?: string;
  phone?: string;
  
  // Emergency contacts
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyAddress?: string;
  emergencyEmail?: string;
  
  // Support categories
  supportCategories?: string[];
  planManagement?: string[];
  howWeSupport?: string[];
  
  // Participant profile
  participantStrengths?: string;
  ndisSupportAsFunded?: string;
  shiftDays?: string;
  shiftTimes?: string;
  preferredGender?: "Male" | "Female" | "Other" | "No";
  requiredSkillSet?: string;
  aboutParticipant?: string;
  likes?: string;
  dislikes?: string;
  
  // Medical information
  medicalConditions?: string;
  medications?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
  }>;
  medicationSideEffects?: string;
  
  // NEW: Behavior fields (multi-select structure)
  behaviourType?: string; // Join of array from database
  behaviourTypes?: string[];
  behaviourTriggers?: string[];
  behaviourOverview?: string;
  
  // Legacy behavior field
  behaviours?: Array<{
    behaviour: string;
    trigger?: string;
    management?: string;
  }>;
  
  // NDIS details
  ndisNumber?: string;
  planStart?: string;
  planEnd?: string;
  fundManagementType?: "NDIA" | "Self" | "Plan";
  
  // Fund Details (NEW - missing fields)
  coreCurrentBalance?: string;
  coreFundedAmount?: string;
  silCurrentBalance?: string;
  silFundedAmount?: string;
  irregularSilCurrentBalance?: string;
  irregularSilFundedAmount?: string;
  otherCurrentBalance?: string;
  otherFundedAmount?: string;
  
  // Invoice details
  invoiceName?: string;
  invoiceEmail?: string;
  invoicePhone?: string;
  invoiceAddress?: string;
  
  // Metadata
  submittedAt: string;
  createdAt?: string;
  status?: string;
  assessment?: {
    decision: string;
    notes?: string;
    assessedBy?: string;
    assessedAt?: string;
  };
}

export default function ReferralViewPage() {
  const [match, params] = useRoute("/compliance/referral-forms/view/:id");
  const referralId = params?.id;

  // PDF Export function
  const handlePDFExport = async () => {
    if (!referral) return;
    
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text('Referral Details', 20, 20);
      
      doc.setFontSize(14);
      doc.text(`Client: ${referral.clientName}`, 20, 35);
      doc.text(`Date of Referral: ${format(new Date(referral.dateOfReferral), "MMMM d, yyyy")}`, 20, 45);
      doc.text(`Status: ${referral.clientStatus}`, 20, 55);
      
      let yPosition = 70;
      
      // Referrer Information
      doc.setFontSize(16);
      doc.text('Referrer Information', 20, yPosition);
      yPosition += 10;
      doc.setFontSize(12);
      doc.text(`Name: ${referral.referrerName}`, 25, yPosition);
      yPosition += 8;
      if (referral.referrerOrg) {
        doc.text(`Organization: ${referral.referrerOrg}`, 25, yPosition);
        yPosition += 8;
      }
      if (referral.referrerPosition) {
        doc.text(`Position: ${referral.referrerPosition}`, 25, yPosition);
        yPosition += 8;
      }
      
      yPosition += 10;
      
      // Support Categories
      if (referral.supportCategories?.length) {
        doc.setFontSize(16);
        doc.text('Support Categories', 20, yPosition);
        yPosition += 10;
        doc.setFontSize(12);
        referral.supportCategories.forEach(category => {
          doc.text(`• ${category}`, 25, yPosition);
          yPosition += 8;
        });
        yPosition += 5;
      }
      
      // Medical Conditions
      if (referral.medicalConditions) {
        doc.setFontSize(16);
        doc.text('Medical Conditions', 20, yPosition);
        yPosition += 10;
        doc.setFontSize(12);
        const medicalText = doc.splitTextToSize(referral.medicalConditions, 170);
        doc.text(medicalText, 25, yPosition);
        yPosition += medicalText.length * 5 + 10;
      }
      
      // Medications (handle array format)
      if (referral.medications) {
        doc.setFontSize(16);
        doc.text('Medications', 20, yPosition);
        yPosition += 10;
        doc.setFontSize(12);
        
        if (Array.isArray(referral.medications)) {
          referral.medications.forEach(med => {
            doc.text(`• ${med.name}`, 25, yPosition);
            yPosition += 8;
            if (med.dosage) {
              doc.text(`  Dosage: ${med.dosage}`, 30, yPosition);
              yPosition += 6;
            }
            if (med.frequency) {
              doc.text(`  Frequency: ${med.frequency}`, 30, yPosition);
              yPosition += 6;
            }
            yPosition += 3;
          });
        } else {
          const medicationsText = doc.splitTextToSize(referral.medications, 170);
          doc.text(medicationsText, 25, yPosition);
          yPosition += medicationsText.length * 5;
        }
        yPosition += 10;
      }
      
      // NEW: Behaviour Information (structured)
      if (referral.behaviourType || referral.behaviourTriggers?.length || referral.behaviourOverview) {
        doc.setFontSize(16);
        doc.text('Behaviours of Concern', 20, yPosition);
        yPosition += 10;
        doc.setFontSize(12);
        
        if (referral.behaviourType) {
          doc.text('Behaviour Types:', 25, yPosition);
          yPosition += 8;
          doc.text(`  ${referral.behaviourType}`, 30, yPosition);
          yPosition += 8;
        }
        
        if (referral.behaviourTriggers?.length) {
          doc.text('Behaviour Triggers:', 25, yPosition);
          yPosition += 8;
          referral.behaviourTriggers.forEach(trigger => {
            doc.text(`• ${trigger}`, 30, yPosition);
            yPosition += 6;
          });
          yPosition += 4;
        }
        
        if (referral.behaviourOverview) {
          doc.text('Behaviour Overview:', 25, yPosition);
          yPosition += 8;
          const overviewText = doc.splitTextToSize(referral.behaviourOverview, 160);
          doc.text(overviewText, 30, yPosition);
          yPosition += overviewText.length * 5 + 8;
        }
        yPosition += 5;
      }
      
      // Legacy Behaviours
      if (referral.behaviours?.length) {
        doc.setFontSize(16);
        doc.text('Legacy Behaviours of Concern', 20, yPosition);
        yPosition += 10;
        doc.setFontSize(12);
        referral.behaviours.forEach(behaviour => {
          doc.text(`• ${behaviour.behaviour}`, 25, yPosition);
          yPosition += 8;
          if (behaviour.trigger) {
            doc.text(`  Trigger: ${behaviour.trigger}`, 30, yPosition);
            yPosition += 6;
          }
          if (behaviour.management) {
            doc.text(`  Management: ${behaviour.management}`, 30, yPosition);
            yPosition += 6;
          }
          yPosition += 3;
        });
        yPosition += 5;
      }
      
      // Fund Details (if available) - Updated to include irregular SIL
      if (referral.coreCurrentBalance || referral.silCurrentBalance || referral.irregularSilCurrentBalance || referral.otherCurrentBalance) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFontSize(16);
        doc.text('Fund Details', 20, yPosition);
        yPosition += 10;
        doc.setFontSize(12);
        
        if (referral.coreCurrentBalance || referral.coreFundedAmount) {
          doc.text('Core Supports:', 25, yPosition);
          yPosition += 8;
          if (referral.coreFundedAmount) {
            doc.text(`  Funded Amount: $${referral.coreFundedAmount}`, 30, yPosition);
            yPosition += 6;
          }
          if (referral.coreCurrentBalance) {
            doc.text(`  Current Balance: $${referral.coreCurrentBalance}`, 30, yPosition);
            yPosition += 6;
          }
        }
        
        if (referral.silCurrentBalance || referral.silFundedAmount) {
          doc.text('SIL Supports:', 25, yPosition);
          yPosition += 8;
          if (referral.silFundedAmount) {
            doc.text(`  Funded Amount: $${referral.silFundedAmount}`, 30, yPosition);
            yPosition += 6;
          }
          if (referral.silCurrentBalance) {
            doc.text(`  Current Balance: $${referral.silCurrentBalance}`, 30, yPosition);
            yPosition += 6;
          }
        }
        yPosition += 10;
      }
      
      // Assessment
      if (referral.assessment) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFontSize(16);
        doc.text('Assessment', 20, yPosition);
        yPosition += 10;
        doc.setFontSize(12);
        doc.text(`Decision: ${referral.assessment.decision}`, 25, yPosition);
        yPosition += 8;
        if (referral.assessment.notes) {
          const assessmentText = doc.splitTextToSize(referral.assessment.notes, 170);
          doc.text('Notes:', 25, yPosition);
          yPosition += 8;
          doc.text(assessmentText, 25, yPosition);
        }
      }
      
      // Save the PDF
      doc.save(`referral-${referral.clientName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

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
            <Button variant="outline" size="sm" onClick={() => handlePDFExport()}>
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
              {referral.dob && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p className="font-medium">{format(new Date(referral.dob), "MMMM d, yyyy")}</p>
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
        {(referral.address || referral.phone || referral.emergencyName) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referral.address && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="font-medium">{referral.address}</p>
                  </div>
                )}
                {referral.phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="font-medium">{referral.phone}</p>
                  </div>
                )}
                {referral.emergencyName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Emergency Contact</label>
                    <p className="font-medium">{referral.emergencyName}</p>
                    {referral.emergencyPhone && (
                      <p className="text-sm text-muted-foreground">{referral.emergencyPhone}</p>
                    )}
                    {referral.emergencyEmail && (
                      <p className="text-sm text-muted-foreground">{referral.emergencyEmail}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support Categories */}
        {(referral.supportCategories?.length || referral.howWeSupport?.length) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="h-5 w-5 mr-2" />
                Support Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {referral.supportCategories?.length && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Support Categories</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {referral.supportCategories.map((category, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {category.replace(/([A-Z])/g, ' $1').trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {referral.howWeSupport?.length && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">How We Support</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {referral.howWeSupport.map((support, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {support.replace(/([A-Z])/g, ' $1').trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Participant Profile */}
        {(referral.aboutParticipant || referral.participantStrengths || referral.likes || referral.dislikes) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="h-5 w-5 mr-2" />
                About Participant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {referral.aboutParticipant && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">About Participant</label>
                  <p className="mt-1">{referral.aboutParticipant}</p>
                </div>
              )}
              {referral.participantStrengths && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Participant Strengths</label>
                  <p className="mt-1">{referral.participantStrengths}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referral.likes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Likes</label>
                    <p className="mt-1">{referral.likes}</p>
                  </div>
                )}
                {referral.dislikes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Dislikes</label>
                    <p className="mt-1">{referral.dislikes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shift Information */}
        {(referral.shiftDays || referral.shiftTimes || referral.preferredGender || referral.requiredSkillSet) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Shift & Support Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referral.shiftDays && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Shift Days</label>
                    <p className="font-medium">{referral.shiftDays}</p>
                  </div>
                )}
                {referral.shiftTimes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Shift Times</label>
                    <p className="font-medium">{referral.shiftTimes}</p>
                  </div>
                )}
                {referral.preferredGender && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Preferred Gender</label>
                    <Badge variant="outline">{referral.preferredGender}</Badge>
                  </div>
                )}
              </div>
              {referral.requiredSkillSet && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Required Skill Set</label>
                  <p className="mt-1">{referral.requiredSkillSet}</p>
                </div>
              )}
              {referral.ndisSupportAsFunded && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">NDIS Support as Funded</label>
                  <p className="mt-1">{referral.ndisSupportAsFunded}</p>
                </div>
              )}
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
        {(referral.coreCurrentBalance || referral.silCurrentBalance || referral.irregularSilCurrentBalance || referral.otherCurrentBalance) && (
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
                
                {/* Irregular SIL Supports */}
                {(referral.irregularSilCurrentBalance || referral.irregularSilFundedAmount) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Irregular SIL Supports</h4>
                    {referral.irregularSilFundedAmount && (
                      <div>
                        <label className="text-xs text-muted-foreground">Funded Amount</label>
                        <p className="font-medium">${referral.irregularSilFundedAmount}</p>
                      </div>
                    )}
                    {referral.irregularSilCurrentBalance && (
                      <div>
                        <label className="text-xs text-muted-foreground">Current Balance</label>
                        <p className="font-medium">${referral.irregularSilCurrentBalance}</p>
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



        {/* Health Information */}
        {(referral.medicalConditions || referral.medications || referral.medicationSideEffects || referral.behaviours?.length || referral.behaviourType || referral.behaviourTriggers?.length || referral.behaviourOverview) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Health Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {referral.medicalConditions && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Medical Conditions</label>
                  <p className="mt-1">{referral.medicalConditions}</p>
                </div>
              )}
              {referral.medications && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Medications</label>
                  <div className="mt-1 space-y-2">
                    {Array.isArray(referral.medications) 
                      ? referral.medications.map((med, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <h5 className="font-medium">{med.name}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                              {med.dosage && (
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Dosage</label>
                                  <p className="text-sm">{med.dosage}</p>
                                </div>
                              )}
                              {med.frequency && (
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Frequency</label>
                                  <p className="text-sm">{med.frequency}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      : <p className="mt-1">{referral.medications}</p>
                    }
                  </div>
                </div>
              )}
              {referral.medicationSideEffects && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Medication Side Effects</label>
                  <p className="mt-1">{referral.medicationSideEffects}</p>
                </div>
              )}
              {/* NEW: Multi-select Behavior Fields */}
              {(referral.behaviourType || referral.behaviourTriggers?.length || referral.behaviourOverview) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Behaviours of Concern</label>
                  <div className="mt-2 space-y-3">
                    {referral.behaviourType && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Behaviour Types</label>
                        <p className="text-sm">{referral.behaviourType}</p>
                      </div>
                    )}
                    {referral.behaviourTriggers?.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Behaviour Triggers</label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {referral.behaviourTriggers.map((trigger, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {trigger}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {referral.behaviourOverview && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Behaviour Overview</label>
                        <p className="text-sm">{referral.behaviourOverview}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Legacy Behavior Fields */}
              {referral.behaviours && referral.behaviours.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Legacy Behaviours of Concern</label>
                  <div className="mt-2 space-y-3">
                    {referral.behaviours.map((behaviour, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <h5 className="font-medium">{behaviour.behaviour}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          {behaviour.trigger && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Triggers</label>
                              <p className="text-sm">{behaviour.trigger}</p>
                            </div>
                          )}
                          {behaviour.management && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Management Strategy</label>
                              <p className="text-sm">{behaviour.management}</p>
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
                    <label className="text-sm font-medium text-muted-foreground">Assessment Notes</label>
                    <p className="mt-1">{referral.assessment.notes}</p>
                  </div>
                )}
                {referral.assessment.assessedBy && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Assessed By</label>
                    <p className="mt-1">{referral.assessment.assessedBy}</p>
                  </div>
                )}
                {referral.assessment.assessedAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Assessment Date</label>
                    <p className="mt-1">{format(new Date(referral.assessment.assessedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
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