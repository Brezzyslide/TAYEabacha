import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Heart, Target, AlertTriangle, HandHeart, Lightbulb, FileText } from 'lucide-react';

const PROGRESS_NOTE_SECTIONS = [
  {
    id: "presentation_mood",
    label: "Client Presentation & Mood",
    description: "Document the client's emotional state, demeanor, and overall presentation during the shift",
    icon: Heart,
    color: "bg-pink-50 border-pink-200",
    placeholder: "Describe the client's mood, emotional state, communication patterns, and any notable behavioral observations throughout the shift..."
  },
  {
    id: "activities_completed",
    label: "Activities Completed",
    description: "Record all scheduled and spontaneous activities engaged in during the shift",
    icon: Target,
    color: "bg-blue-50 border-blue-200",
    placeholder: "List and describe activities completed, client participation level, engagement quality, and any modifications made to planned activities..."
  },
  {
    id: "goals_worked_on",
    label: "Goals Worked On",
    description: "Document progress toward NDIS goals and skill development",
    icon: Target,
    color: "bg-green-50 border-green-200",
    placeholder: "Specify which NDIS goals were addressed, progress made, skills practiced, and measurable outcomes achieved..."
  },
  {
    id: "challenges_concerns",
    label: "Challenges or Concerns",
    description: "Note any difficulties, safety issues, or areas requiring additional support",
    icon: AlertTriangle,
    color: "bg-orange-50 border-orange-200",
    placeholder: "Describe any challenges encountered, safety considerations, behavioral concerns, or areas where the client required additional support..."
  },
  {
    id: "support_provided",
    label: "Support Provided",
    description: "Detail the assistance, coaching, and adaptive strategies used",
    icon: HandHeart,
    color: "bg-purple-50 border-purple-200",
    placeholder: "Explain the type of support given, teaching moments, coaching strategies, and adaptive techniques used throughout the shift..."
  },
  {
    id: "recommendations",
    label: "Recommendations for Future",
    description: "Provide actionable recommendations for upcoming shifts and ongoing care",
    icon: Lightbulb,
    color: "bg-yellow-50 border-yellow-200",
    placeholder: "Suggest strategies to continue, areas to focus on in future shifts, adjustments needed, and follow-up actions required..."
  }
];

interface ProgressNoteSectionsProps {
  value: Array<{ id: string; content: string }>;
  onChange: (sections: Array<{ id: string; content: string }>) => void;
}

export default function ProgressNoteSections({ value, onChange }: ProgressNoteSectionsProps) {
  const [selectedSections, setSelectedSections] = useState<string[]>(
    value.map(s => s.id) || []
  );
  const [sectionContent, setSectionContent] = useState<Record<string, string>>(
    value.reduce((acc, s) => ({ ...acc, [s.id]: s.content }), {}) || {}
  );
  const [showDialog, setShowDialog] = useState(false);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [tempContent, setTempContent] = useState("");

  const updateParent = (selected: string[], content: Record<string, string>) => {
    const sections = selected.map(id => ({
      id,
      content: content[id] || ""
    }));
    onChange(sections);
  };

  const toggleSection = (id: string) => {
    if (selectedSections.includes(id)) {
      // Unchecking - remove the section
      const newSelected = selectedSections.filter(s => s !== id);
      const newContent = { ...sectionContent };
      delete newContent[id];
      
      setSelectedSections(newSelected);
      setSectionContent(newContent);
      updateParent(newSelected, newContent);
    } else {
      // Checking - show popup for content
      setCurrentSection(id);
      setTempContent(sectionContent[id] || "");
      setShowDialog(true);
    }
  };

  const saveSection = () => {
    if (currentSection && tempContent.trim()) {
      const newSelected = [...selectedSections, currentSection];
      const newContent = { ...sectionContent, [currentSection]: tempContent.trim() };
      
      setSelectedSections(newSelected);
      setSectionContent(newContent);
      updateParent(newSelected, newContent);
      
      setShowDialog(false);
      setCurrentSection(null);
      setTempContent("");
    }
  };

  const cancelSection = () => {
    setShowDialog(false);
    setCurrentSection(null);
    setTempContent("");
  };

  const editSection = (id: string) => {
    setCurrentSection(id);
    setTempContent(sectionContent[id] || "");
    setShowDialog(true);
  };

  const currentSectionData = currentSection ? PROGRESS_NOTE_SECTIONS.find(s => s.id === currentSection) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Progress Note Sections</h3>
          <Badge variant="outline">
            {selectedSections.length} of {PROGRESS_NOTE_SECTIONS.length} sections completed
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Select the relevant sections for your progress note. Each section requires detailed documentation.
        </p>
      </div>

      <div className="grid gap-4">
        {PROGRESS_NOTE_SECTIONS.map(section => {
          const IconComponent = section.icon;
          const isSelected = selectedSections.includes(section.id);
          const hasContent = sectionContent[section.id]?.trim().length > 0;
          
          return (
            <div key={section.id} className={`rounded-lg border p-4 transition-all ${
              isSelected ? section.color : "bg-muted/20"
            }`}>
              <div className="flex items-start space-x-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSection(section.id)}
                  id={section.id}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4" />
                    <Label htmlFor={section.id} className="font-medium cursor-pointer">
                      {section.label}
                    </Label>
                    {isSelected && hasContent && (
                      <Badge variant="secondary" className="text-xs">
                        ✓ Completed
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                  
                  {isSelected && hasContent && (
                    <div className="mt-2 p-3 bg-white/50 rounded border text-sm">
                      <p className="font-medium text-xs text-muted-foreground mb-1">Content Preview:</p>
                      <p className="line-clamp-2">{sectionContent[section.id]}</p>
                      <Button 
                        type="button"
                        variant="link" 
                        size="sm" 
                        onClick={() => editSection(section.id)}
                        className="h-auto p-0 mt-1 text-xs"
                      >
                        Edit content
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedSections.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Selected Sections Summary:
          </h4>
          <div className="space-y-2">
            {selectedSections.map(id => {
              const section = PROGRESS_NOTE_SECTIONS.find(s => s.id === id);
              const content = sectionContent[id];
              
              return (
                <div key={id} className="text-sm">
                  <span className="font-medium">{section?.label}:</span>{" "}
                  <span className="text-muted-foreground">
                    {content?.trim() ? `${content.substring(0, 50)}...` : "Content pending..."}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentSectionData?.icon && <currentSectionData.icon className="h-5 w-5" />}
              {currentSectionData?.label}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {currentSectionData && (
              <div className={`p-3 rounded-lg ${currentSectionData.color}`}>
                <p className="text-sm font-medium mb-1">
                  {currentSectionData.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentSectionData.description}
                </p>
              </div>
            )}
            
            <div>
              <Label htmlFor="section-content" className="text-sm font-medium">
                Please provide detailed information for this section *
              </Label>
              <Textarea
                id="section-content"
                value={tempContent}
                onChange={(e) => setTempContent(e.target.value)}
                placeholder={currentSectionData?.placeholder}
                className="mt-1 min-h-[120px]"
                rows={6}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Current length: {tempContent.length} characters
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={cancelSection}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={saveSection}
              disabled={!tempContent.trim()}
            >
              Save Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}