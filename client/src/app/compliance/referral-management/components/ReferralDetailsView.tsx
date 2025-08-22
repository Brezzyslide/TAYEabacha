import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface ReferralDetailsViewProps {
  referral: {
    id: string;
    clientName: string;
    referrerName: string;
    referrerOrg?: string;
    referrerPosition?: string;
    referrerContact?: string;
    submittedAt: string;
    status: string;
    dateOfReferral: string;
    supportCategories: string[];
    howWeSupport: string[];
    aboutParticipant?: string;
    participantStrengths?: string;
    likes?: string;
    dislikes?: string;
    medicalConditions?: string;
    medications?: Array<{
      name: string;
      dosage?: string;
      frequency?: string;
    }>;
    medicationSideEffects?: string;
    behaviours?: Array<{
      behaviour: string;
      trigger?: string;
      management?: string;
    }>;
    ndisNumber?: string;
    planStart?: string;
    planEnd?: string;
    fundManagementType?: string;
    dob?: string;
    address?: string;
    phone?: string;
    emergencyName?: string;
    emergencyPhone?: string;
    emergencyAddress?: string;
    emergencyEmail?: string;
    assessment?: {
      organizationalCapacity?: string;
      skillsetCapacity?: string;
      fundingSufficient?: string;
      restrictivePractice?: string;
      manualHandling?: string;
      medicationManagement?: string;
      supportOverview?: string;
      decision?: string;
      declineReason?: string;
      referralPathway?: string;
    };
  };
}

export function ReferralDetailsView({ referral }: ReferralDetailsViewProps) {
  return (
    <div className="space-y-6">
      {/* Client Information */}
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="font-medium">{referral.clientName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">NDIS Number</label>
              <p>{referral.ndisNumber || "Not provided"}</p>
            </div>
            {referral.dob && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                <p>{format(new Date(referral.dob), "PPP")}</p>
              </div>
            )}
            {referral.phone && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p>{referral.phone}</p>
              </div>
            )}
          </div>
          {referral.address && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Address</label>
              <p>{referral.address}</p>
            </div>
          )}
          {(referral.planStart || referral.planEnd) && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">NDIS Plan Period</label>
              <p>
                {referral.planStart ? format(new Date(referral.planStart), "PPP") : "Not specified"} - {" "}
                {referral.planEnd ? format(new Date(referral.planEnd), "PPP") : "Ongoing"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referrer Information */}
      <Card>
        <CardHeader>
          <CardTitle>Referrer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="font-medium">{referral.referrerName}</p>
            </div>
            {referral.referrerOrg && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Organization</label>
                <p>{referral.referrerOrg}</p>
              </div>
            )}
            {referral.referrerPosition && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Position</label>
                <p>{referral.referrerPosition}</p>
              </div>
            )}
            {referral.referrerContact && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Contact</label>
                <p>{referral.referrerContact}</p>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Date Submitted</label>
            <p>{format(new Date(referral.submittedAt), "PPP p")}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Referral Date</label>
            <p>{format(new Date(referral.dateOfReferral), "PPP")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      {(referral.emergencyName || referral.emergencyPhone) && (
        <Card>
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {referral.emergencyName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p>{referral.emergencyName}</p>
                </div>
              )}
              {referral.emergencyPhone && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p>{referral.emergencyPhone}</p>
                </div>
              )}
            </div>
            {referral.emergencyAddress && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Address</label>
                <p>{referral.emergencyAddress}</p>
              </div>
            )}
            {referral.emergencyEmail && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p>{referral.emergencyEmail}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Support Details */}
      <Card>
        <CardHeader>
          <CardTitle>Support Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Support Categories</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {referral.supportCategories?.length > 0 ? (
                referral.supportCategories.map((category) => (
                  <Badge key={category} variant="outline">
                    {category}
                  </Badge>
                ))
              ) : (
                <p className="text-muted-foreground">None specified</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">How We Support</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {referral.howWeSupport?.length > 0 ? (
                referral.howWeSupport.map((support) => (
                  <Badge key={support} variant="secondary">
                    {support}
                  </Badge>
                ))
              ) : (
                <p className="text-muted-foreground">None specified</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participant Information */}
      <Card>
        <CardHeader>
          <CardTitle>About the Participant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {referral.aboutParticipant && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">About Participant</label>
              <p className="mt-1 whitespace-pre-wrap">{referral.aboutParticipant}</p>
            </div>
          )}
          {referral.participantStrengths && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Strengths</label>
              <p className="mt-1 whitespace-pre-wrap">{referral.participantStrengths}</p>
            </div>
          )}
          {referral.likes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Likes/Interests</label>
              <p className="mt-1 whitespace-pre-wrap">{referral.likes}</p>
            </div>
          )}
          {referral.dislikes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Dislikes/Triggers</label>
              <p className="mt-1 whitespace-pre-wrap">{referral.dislikes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Information */}
      <Card>
        <CardHeader>
          <CardTitle>Medical Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {referral.medicalConditions && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Medical Conditions</label>
              <p className="mt-1 whitespace-pre-wrap">{referral.medicalConditions}</p>
            </div>
          )}
          
          {referral.medications && referral.medications.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Medications</label>
              <div className="mt-2 space-y-2">
                {referral.medications.map((med, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="font-medium">{med.name}</div>
                    {(med.dosage || med.frequency) && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {med.dosage && <span>Dosage: {med.dosage}</span>}
                        {med.dosage && med.frequency && <span> • </span>}
                        {med.frequency && <span>Frequency: {med.frequency}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {referral.medicationSideEffects && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Medication Side Effects</label>
              <p className="mt-1 whitespace-pre-wrap">{referral.medicationSideEffects}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Behaviours of Concern */}
      {referral.behaviours && referral.behaviours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Behaviours of Concern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {referral.behaviours.map((behaviour, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">{behaviour.behaviour}</div>
                  {behaviour.trigger && (
                    <div className="text-sm text-muted-foreground mb-1">
                      <span className="font-medium">Trigger:</span> {behaviour.trigger}
                    </div>
                  )}
                  {behaviour.management && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Management:</span> {behaviour.management}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assessment Results */}
      {referral.assessment && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Organizational Capacity</label>
                <Badge variant={referral.assessment.organizationalCapacity === "yes" ? "default" : "secondary"}>
                  {referral.assessment.organizationalCapacity}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Skillset Capacity</label>
                <Badge variant={referral.assessment.skillsetCapacity === "yes" ? "default" : "secondary"}>
                  {referral.assessment.skillsetCapacity}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Funding Sufficient</label>
                <Badge variant={referral.assessment.fundingSufficient === "yes" ? "default" : "secondary"}>
                  {referral.assessment.fundingSufficient}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Restrictive Practice</label>
                <Badge variant={referral.assessment.restrictivePractice === "no" ? "default" : "destructive"}>
                  {referral.assessment.restrictivePractice}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Manual Handling</label>
                <Badge variant={referral.assessment.manualHandling === "no" ? "default" : "secondary"}>
                  {referral.assessment.manualHandling}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Medication Management</label>
                <Badge variant={referral.assessment.medicationManagement === "no" ? "default" : "secondary"}>
                  {referral.assessment.medicationManagement}
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-muted-foreground">Decision</label>
              <Badge 
                variant={
                  referral.assessment.decision === "proceed" ? "default" : 
                  referral.assessment.decision === "decline" ? "destructive" : "secondary"
                }
                className="ml-2"
              >
                {referral.assessment.decision}
              </Badge>
            </div>

            {referral.assessment.supportOverview && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Support Overview</label>
                <p className="mt-1 whitespace-pre-wrap">{referral.assessment.supportOverview}</p>
              </div>
            )}

            {referral.assessment.declineReason && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Decline Reason</label>
                <p className="mt-1 whitespace-pre-wrap">{referral.assessment.declineReason}</p>
              </div>
            )}

            {referral.assessment.referralPathway && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Referral Pathway</label>
                <p className="mt-1 whitespace-pre-wrap">{referral.assessment.referralPathway}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge 
            variant={
              referral.status === "approved" ? "default" : 
              referral.status === "declined" ? "destructive" : "secondary"
            }
            className="text-lg px-4 py-2"
          >
            {referral.status}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}