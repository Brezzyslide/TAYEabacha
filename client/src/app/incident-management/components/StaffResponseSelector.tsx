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
    id: "co_regulation",
    label: "Co-regulation",
    description: "Staff remained calm, offered emotional presence, and helped regulate the participant's emotional state.",
  },
  {
    id: "redirection",
    label: "Redirection",
    description: "Participant was gently guided to a different task, topic, or setting to reduce escalation.",
  },
  {
    id: "self_regulation_strategy",
    label: "Self-regulation strategy prompted",
    description: "Participant was reminded to use their own strategies (e.g. deep breathing, sensory tools).",
  },
  {
    id: "replacement_behaviour",
    label: "Replacement behaviour encouraged",
    description: "Staff promoted a safer or more appropriate behaviour (e.g. using words instead of hitting).",
  },
  {
    id: "alternative_activity",
    label: "Suggested alternative activity",
    description: "A preferred or calming activity was offered as a substitute.",
  },
  {
    id: "environmental_control",
    label: "Environmental control",
    description: "Adjustments were made to lighting, sound, crowding, or proximity to reduce overload.",
  },
  {
    id: "staff_withdrawal",
    label: "Staff withdrawal / space provided",
    description: "Staff stepped back to reduce stimulation or confrontation.",
  },
  {
    id: "increased_supervision",
    label: "Increased supervision applied",
    description: "Additional staff or closer monitoring was initiated.",
  },
  {
    id: "pbs_strategy",
    label: "Positive Behaviour Support strategy used",
    description: "Intervention aligned with PBS plan (e.g. proactive/reinforcement-based strategy).",
  },
  {
    id: "prn_medication",
    label: "PRN medication administered",
    description: "As per medication protocol and with required authorisation.",
  },
  {
    id: "restrictive_practice",
    label: "Restrictive practice implemented",
    description: "Time-limited restriction used (e.g. physical, mechanical, environmental) — must be recorded per NDIS rules.",
  },
  {
    id: "verbal_de_escalation",
    label: "Verbal de-escalation",
    description: "Used calm tone, validation, and reassurance.",
  },
  {
    id: "emergency_response",
    label: "Emergency response activated",
    description: "Security, emergency services, or on-call support contacted.",
  },
  {
    id: "family_contacted",
    label: "Parent / Guardian / Substitute Decision Maker contacted",
    description: "Family or guardian notified during or after the incident.",
  },
  {
    id: "medical_support",
    label: "Medical support provided",
    description: "First aid or clinical team engaged.",
  },
  {
    id: "debrief_offered",
    label: "Debrief offered to participant",
    description: "Post-incident support provided to participant, if appropriate.",
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
      setShowDialog(true)
    }
  }

  const handleDialogSave = () => {
    if (!currentResponse) return
    
    if (!tempDetails.trim()) {
      alert("Please provide details for this response action.")
      return
    }
    

    
    const newSelected = [...selectedResponses, currentResponse]
    const newDetails = { 
      ...details, 
      [currentResponse]: tempDetails
    }
    
    setSelectedResponses(newSelected)
    setDetails(newDetails)
    setShowDialog(false)
    setCurrentResponse(null)
    setTempDetails("")
    
    updateParent(newSelected, newDetails)
  }

  const handleDialogCancel = () => {
    setShowDialog(false)
    setCurrentResponse(null)
    setTempDetails("")
  }

  const updateParent = (responses: string[], responseDetails: Record<string, string>) => {
    const responseData = responses.map(responseId => {
      const response = RESPONSES.find(r => r.id === responseId)
      return {
        id: responseId,
        label: response?.label || '',
        details: responseDetails[responseId] || ''
      }
    })
    onChange(responseData)
  }

  return (
    <>
      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Staff Response Actions *</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select all actions taken by staff during or after the incident. You'll be prompted to provide details for each response. <span className="text-red-500 font-medium">At least one response must be selected.</span>
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
                const responseLabel = response?.label
                const responseDetails = details[id]
                
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
              Response Details Required
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