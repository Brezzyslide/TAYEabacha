import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const RESPONSES = [
  {
    id: "de_escalation",
    label: "De-escalation techniques",
    description: "Verbal techniques, calm communication, redirection strategies, or environmental modifications to reduce tension.",
  },
  {
    id: "physical_intervention",
    label: "Physical intervention",
    description: "Physical restraint, blocking, or protective positioning as per approved techniques and training.",
  },
  {
    id: "redirection",
    label: "Redirection",
    description: "Guided the individual to alternative activities or environments to prevent escalation.",
  },
  {
    id: "environmental_modification",
    label: "Environmental modification",
    description: "Changes to the immediate environment such as reducing noise, adjusting lighting, or removing triggers.",
  },
  {
    id: "medication_administration",
    label: "Medication administration",
    description: "PRN medication given as prescribed, including time, dosage, and authorization details.",
  },
  {
    id: "medical_attention",
    label: "Medical attention",
    description: "First aid provided, injury assessment, or medical professional consultation.",
  },
  {
    id: "emergency_services",
    label: "Emergency services called",
    description: "Police, ambulance, or fire services contacted due to severity of incident or safety concerns.",
  },
  {
    id: "supervisor_notified",
    label: "Supervisor notified",
    description: "Team leader, coordinator, or manager informed of the incident and response actions.",
  },
  {
    id: "family_contacted",
    label: "Family contacted",
    description: "Next of kin, guardian, or family member informed about the incident.",
  },
  {
    id: "documentation_completed",
    label: "Documentation completed",
    description: "Incident reports, behavior charts, or other required documentation filled out.",
  },
  {
    id: "other",
    label: "Other response",
    description: "A response action not covered by the above categories.",
  },
]

interface ResponseData {
  id: string;
  label: string;
  details: string;
}

interface StaffResponseSelectorProps {
  value: ResponseData[];
  onChange: (responses: ResponseData[]) => void;
}

export function StaffResponseSelector({ value, onChange }: StaffResponseSelectorProps) {
  const [selectedResponses, setSelectedResponses] = useState<string[]>(
    value.map(r => r.id) || []
  )
  const [details, setDetails] = useState<Record<string, string>>(
    value.reduce((acc, r) => ({ ...acc, [r.id]: r.details }), {}) || {}
  )
  const [showDialog, setShowDialog] = useState(false)
  const [currentResponse, setCurrentResponse] = useState<string | null>(null)
  const [tempDetails, setTempDetails] = useState("")
  const [tempOtherLabel, setTempOtherLabel] = useState("")

  const toggleResponse = (id: string) => {
    if (selectedResponses.includes(id)) {
      // Unchecking - remove the response
      const newSelected = selectedResponses.filter(r => r !== id)
      const newDetails = { ...details }
      delete newDetails[id]
      
      setSelectedResponses(newSelected)
      setDetails(newDetails)
      updateParent(newSelected, newDetails)
    } else {
      // Checking - show popup for details
      setCurrentResponse(id)
      setTempDetails(details[id] || "")
      setTempOtherLabel(id === "other" ? (details[id]?.split(":")[0] || "") : "")
      setShowDialog(true)
    }
  }

  const handleDialogSave = () => {
    if (!currentResponse) return
    
    if (!tempDetails.trim()) {
      alert("Please provide details for this response action.")
      return
    }
    
    if (currentResponse === "other" && !tempOtherLabel.trim()) {
      alert("Please specify what the 'Other' response action was.")
      return
    }
    
    const newSelected = [...selectedResponses, currentResponse]
    const newDetails = { 
      ...details, 
      [currentResponse]: currentResponse === "other" 
        ? `${tempOtherLabel}: ${tempDetails}`
        : tempDetails
    }
    
    setSelectedResponses(newSelected)
    setDetails(newDetails)
    setShowDialog(false)
    setCurrentResponse(null)
    setTempDetails("")
    setTempOtherLabel("")
    
    updateParent(newSelected, newDetails)
  }

  const handleDialogCancel = () => {
    setShowDialog(false)
    setCurrentResponse(null)
    setTempDetails("")
    setTempOtherLabel("")
  }

  const updateParent = (responses: string[], responseDetails: Record<string, string>) => {
    const responseData = responses.map(responseId => {
      const response = RESPONSES.find(r => r.id === responseId)
      return {
        id: responseId,
        label: responseId === "other" 
          ? responseDetails[responseId]?.split(":")[0] || "Other"
          : response?.label || '',
        details: responseId === "other"
          ? responseDetails[responseId]?.split(":").slice(1).join(":").trim() || ""
          : responseDetails[responseId] || ''
      }
    })
    onChange(responseData)
  }

  return (
    <>
      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Staff Response Actions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select all actions taken by staff during or after the incident. You'll be prompted to provide details for each response.
          </p>
        </div>
        
        {RESPONSES.map(response => (
          <div key={response.id} className="space-y-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedResponses.includes(response.id)}
                onCheckedChange={() => toggleResponse(response.id)}
                id={response.id}
              />
              <Label htmlFor={response.id} className="font-medium">
                {response.label}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground ml-6">{response.description}</p>
          </div>
        ))}

        {selectedResponses.length > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Selected Responses:</h4>
            <div className="space-y-2">
              {selectedResponses.map(id => {
                const response = RESPONSES.find(r => r.id === id)
                const responseLabel = id === "other" 
                  ? details[id]?.split(":")[0] || "Other"
                  : response?.label
                const responseDetails = id === "other"
                  ? details[id]?.split(":").slice(1).join(":").trim()
                  : details[id]
                
                return (
                  <div key={id} className="text-sm">
                    <span className="font-medium">{responseLabel}:</span>{" "}
                    <span className="text-muted-foreground">
                      {responseDetails || "Details pending..."}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentResponse === "other" ? "Specify Other Response" : "Response Details Required"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {currentResponse && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  {RESPONSES.find(r => r.id === currentResponse)?.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {RESPONSES.find(r => r.id === currentResponse)?.description}
                </p>
              </div>
            )}
            
            {currentResponse === "other" && (
              <div>
                <Label htmlFor="other-response-label" className="text-sm font-medium">
                  What was the specific response action? *
                </Label>
                <Input
                  id="other-response-label"
                  value={tempOtherLabel}
                  onChange={(e) => setTempOtherLabel(e.target.value)}
                  placeholder="e.g., Called care coordinator, Adjusted seating, etc."
                  className="mt-1"
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="response-details" className="text-sm font-medium">
                Please provide specific details about this response action *
              </Label>
              <Textarea
                id="response-details"
                value={tempDetails}
                onChange={(e) => setTempDetails(e.target.value)}
                placeholder="Describe exactly what was done, when, and the outcome of this response action..."
                className="mt-1 min-h-[100px]"
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogCancel}>
              Cancel
            </Button>
            <Button onClick={handleDialogSave}>
              Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}