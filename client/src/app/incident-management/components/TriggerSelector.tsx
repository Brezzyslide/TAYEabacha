import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const TRIGGERS = [
  {
    id: "choice_control",
    label: "Lack of choice and control",
    description: "Individual is not offered options or autonomy in daily decisions (e.g. meals, activities, clothing).",
  },
  {
    id: "change_routine",
    label: "Changes in routine",
    description: "Unplanned or unexplained disruptions to known schedules (e.g. missed outings, new support worker).",
  },
  {
    id: "unmet_needs",
    label: "Unmet needs",
    description: "Delays or absence of support for basic needs (e.g. hunger, hygiene, rest, medical care, emotional regulation).",
  },
  {
    id: "sensory",
    label: "Sensory overload or discomfort",
    description: "Exposure to overwhelming stimuli (e.g. loud noises, bright lights, strong smells, physical touch).",
  },
  {
    id: "communication",
    label: "Poor communication or being misunderstood",
    description: "Limited access to AAC, complex instructions, or lack of validation leading to frustration.",
  },
  {
    id: "structure_loss",
    label: "Loss of predictability or structure",
    description: "Inconsistent support routines, unclear expectations, or lack of visual/temporal cues.",
  },
  {
    id: "disrespect",
    label: "Feeling disrespected or excluded",
    description: "Not being heard, ignored, spoken over, or left out of peer/staff interaction.",
  },
  {
    id: "unfamiliarity",
    label: "Unfamiliar environments or people",
    description: "Anxiety or distress from being in a new setting or interacting with unfamiliar staff/peers.",
  },
  {
    id: "health_discomfort",
    label: "Health discomfort or untreated pain",
    description: "Physical distress due to illness, pain, or side effects of medication not being identified or addressed.",
  },
  {
    id: "trauma_triggers",
    label: "Past trauma or distress triggers",
    description: "Exposure to reminders of past trauma (e.g. restraint, tone of voice, uniforms, confrontation).",
  },
  {
    id: "other",
    label: "Other",
    description: "A trigger not covered by the above categories.",
  },
]

interface TriggerData {
  id: string;
  label: string;
  details: string;
}

interface TriggerSelectorProps {
  value: TriggerData[];
  onChange: (triggers: TriggerData[]) => void;
}

export function TriggerSelector({ value, onChange }: TriggerSelectorProps) {
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(
    value.map(t => t.id) || []
  )
  const [details, setDetails] = useState<Record<string, string>>(
    value.reduce((acc, t) => ({ ...acc, [t.id]: t.details }), {}) || {}
  )
  const [showDialog, setShowDialog] = useState(false)
  const [currentTrigger, setCurrentTrigger] = useState<string | null>(null)
  const [tempDetails, setTempDetails] = useState("")
  const [tempOtherLabel, setTempOtherLabel] = useState("")

  const toggleTrigger = (id: string) => {
    if (selectedTriggers.includes(id)) {
      // Unchecking - remove the trigger
      const newSelected = selectedTriggers.filter(t => t !== id)
      const newDetails = { ...details }
      delete newDetails[id]
      
      setSelectedTriggers(newSelected)
      setDetails(newDetails)
      updateParent(newSelected, newDetails)
    } else {
      // Checking - show popup for details
      const trigger = TRIGGERS.find(t => t.id === id)
      setCurrentTrigger(id)
      setTempDetails(details[id] || "")
      setTempOtherLabel(id === "other" ? (details[id]?.split(":")[0] || "") : "")
      setShowDialog(true)
    }
  }

  const handleDialogSave = () => {
    if (!currentTrigger) return
    
    const trigger = TRIGGERS.find(t => t.id === currentTrigger)
    if (!tempDetails.trim()) {
      alert("Please provide details for this trigger.")
      return
    }
    
    if (currentTrigger === "other" && !tempOtherLabel.trim()) {
      alert("Please specify what the 'Other' trigger is.")
      return
    }
    
    const newSelected = [...selectedTriggers, currentTrigger]
    const newDetails = { 
      ...details, 
      [currentTrigger]: currentTrigger === "other" 
        ? `${tempOtherLabel}: ${tempDetails}`
        : tempDetails
    }
    
    setSelectedTriggers(newSelected)
    setDetails(newDetails)
    setShowDialog(false)
    setCurrentTrigger(null)
    setTempDetails("")
    setTempOtherLabel("")
    
    updateParent(newSelected, newDetails)
  }

  const handleDialogCancel = () => {
    setShowDialog(false)
    setCurrentTrigger(null)
    setTempDetails("")
    setTempOtherLabel("")
  }

  const updateParent = (triggers: string[], triggerDetails: Record<string, string>) => {
    const triggerData = triggers.map(triggerId => {
      const trigger = TRIGGERS.find(t => t.id === triggerId)
      return {
        id: triggerId,
        label: triggerId === "other" 
          ? triggerDetails[triggerId]?.split(":")[0] || "Other"
          : trigger?.label || '',
        details: triggerId === "other"
          ? triggerDetails[triggerId]?.split(":").slice(1).join(":").trim() || ""
          : triggerDetails[triggerId] || ''
      }
    })
    onChange(triggerData)
  }

  return (
    <>
      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Select Incident Triggers *</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose all triggers that may have contributed to this incident. You'll be prompted to provide details for each selection. <span className="text-red-500 font-medium">At least one trigger must be selected.</span>
          </p>
        </div>
        
        {TRIGGERS.map(trigger => (
          <div key={trigger.id} className="space-y-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedTriggers.includes(trigger.id)}
                onCheckedChange={() => toggleTrigger(trigger.id)}
                id={trigger.id}
              />
              <Label htmlFor={trigger.id} className="font-medium">
                {trigger.label}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground ml-6">{trigger.description}</p>
          </div>
        ))}

        {selectedTriggers.length > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Selected Triggers:</h4>
            <div className="space-y-2">
              {selectedTriggers.map(id => {
                const trigger = TRIGGERS.find(t => t.id === id)
                const triggerLabel = id === "other" 
                  ? details[id]?.split(":")[0] || "Other"
                  : trigger?.label
                const triggerDetails = id === "other"
                  ? details[id]?.split(":").slice(1).join(":").trim()
                  : details[id]
                
                return (
                  <div key={id} className="text-sm">
                    <span className="font-medium">{triggerLabel}:</span>{" "}
                    <span className="text-muted-foreground">
                      {triggerDetails || "Details pending..."}
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
              {currentTrigger === "other" ? "Specify Other Trigger" : "Trigger Details Required"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {currentTrigger && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  {TRIGGERS.find(t => t.id === currentTrigger)?.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {TRIGGERS.find(t => t.id === currentTrigger)?.description}
                </p>
              </div>
            )}
            
            {currentTrigger === "other" && (
              <div>
                <Label htmlFor="other-label" className="text-sm font-medium">
                  What is the specific trigger? *
                </Label>
                <Input
                  id="other-label"
                  value={tempOtherLabel}
                  onChange={(e) => setTempOtherLabel(e.target.value)}
                  placeholder="e.g., Medication side effects, Peer conflict, etc."
                  className="mt-1"
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="trigger-details" className="text-sm font-medium">
                Please explain how this trigger contributed to the incident *
              </Label>
              <Textarea
                id="trigger-details"
                value={tempDetails}
                onChange={(e) => setTempDetails(e.target.value)}
                placeholder="Provide specific details about how this trigger led to or contributed to the incident..."
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