import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

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
  const [showInputs, setShowInputs] = useState(value.length > 0)

  const toggleTrigger = (id: string) => {
    const newSelected = selectedTriggers.includes(id) 
      ? selectedTriggers.filter(t => t !== id) 
      : [...selectedTriggers, id]
    
    setSelectedTriggers(newSelected)
    
    // If unchecking, remove from details
    if (selectedTriggers.includes(id)) {
      const newDetails = { ...details }
      delete newDetails[id]
      setDetails(newDetails)
    }
  }

  const handleAdd = () => {
    if (selectedTriggers.length === 0) return
    setShowInputs(true)
  }

  const handleDetailsChange = (id: string, value: string) => {
    const newDetails = { ...details, [id]: value }
    setDetails(newDetails)
    
    // Update parent component
    const triggerData = selectedTriggers.map(triggerId => {
      const trigger = TRIGGERS.find(t => t.id === triggerId)
      return {
        id: triggerId,
        label: trigger?.label || '',
        details: newDetails[triggerId] || ''
      }
    })
    onChange(triggerData)
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Incident Triggers</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose all triggers that may have contributed to this incident
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

      {!showInputs && selectedTriggers.length > 0 && (
        <Button onClick={handleAdd} className="mt-4">
          Add Details for Selected Triggers
        </Button>
      )}

      {showInputs && selectedTriggers.map(id => {
        const trigger = TRIGGERS.find(t => t.id === id)
        return (
          <div key={id} className="mt-4 space-y-2">
            <Label className="font-semibold text-sm">
              {trigger?.label} - Details
            </Label>
            <Textarea
              placeholder="Describe how this trigger contributed to the incident..."
              value={details[id] || ""}
              onChange={(e) => handleDetailsChange(id, e.target.value)}
              className="min-h-[80px]"
              rows={3}
            />
          </div>
        )
      })}
    </Card>
  )
}