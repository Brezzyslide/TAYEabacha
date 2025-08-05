import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Target, AlertTriangle, HandHeart, Lightbulb, FileText, Eye, Sparkles } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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
  onChange: (sections: Array<{ id: string; content: string }>, additionalNotes?: string) => void;
}

export default function ProgressNoteSections({ value, onChange }: ProgressNoteSectionsProps) {
  const { toast } = useToast();
  const [selectedSections, setSelectedSections] = useState<string[]>(
    value.map(s => s.id) || []
  );
  const [sectionContent, setSectionContent] = useState<Record<string, string>>(
    value.reduce((acc, s) => ({ ...acc, [s.id]: s.content }), {}) || {}
  );
  const [showDialog, setShowDialog] = useState(false);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [tempContent, setTempContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [spellCheckCount, setSpellCheckCount] = useState(0);
  const [showSpellCheckPreview, setShowSpellCheckPreview] = useState(false);
  const [spellCheckResult, setSpellCheckResult] = useState<{ original: string; corrected: string } | null>(null);

  // Word count calculation
  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const updateParent = (selected: string[], content: Record<string, string>, notes?: string) => {
    const sections = selected.map(id => ({
      id,
      content: content[id] || ""
    }));
    onChange(sections, notes);
  };

  // Spell check mutation for additional notes
  const spellCheckMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/spellcheck-gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Spell check failed');
      return response.json();
    },
    onSuccess: (data: { original: string; corrected: string }) => {
      setSpellCheckResult(data);
      setShowSpellCheckPreview(true);
      toast({
        title: "Spell Check Complete",
        description: "Review the suggested corrections below.",
      });
    },
    onError: () => {
      toast({
        title: "Spell Check Failed",
        description: "Unable to perform spell check. Please try again.",
        variant: "destructive",
      });
    },
  });

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
      const wordCount = getWordCount(tempContent);
      if (wordCount < 30) {
        toast({
          title: "Insufficient Content",
          description: `This section requires at least 30 words. Current: ${wordCount} words.`,
          variant: "destructive",
        });
        return;
      }

      const newSelected = [...selectedSections, currentSection];
      const newContent = { ...sectionContent, [currentSection]: tempContent.trim() };
      
      setSelectedSections(newSelected);
      setSectionContent(newContent);
      updateParent(newSelected, newContent, additionalNotes);
      
      setShowDialog(false);
      setCurrentSection(null);
      setTempContent("");
    }
  };

  const handleSpellCheck = () => {
    if (spellCheckCount >= 2) {
      toast({
        title: "Spell Check Limit Reached",
        description: "You have used all 2 spell checks for additional notes.",
        variant: "destructive",
      });
      return;
    }

    if (!additionalNotes.trim()) {
      toast({
        title: "No Content",
        description: "Please enter some content before spell checking.",
        variant: "destructive",
      });
      return;
    }

    setSpellCheckCount(prev => prev + 1);
    spellCheckMutation.mutate(additionalNotes);
  };

  const acceptSpellCheck = () => {
    if (spellCheckResult) {
      setAdditionalNotes(spellCheckResult.corrected);
      setShowSpellCheckPreview(false);
      setSpellCheckResult(null);
      updateParent(selectedSections, sectionContent, spellCheckResult.corrected);
      toast({
        title: "Corrections Applied",
        description: "Spell check corrections have been applied.",
      });
    }
  };

  const rejectSpellCheck = () => {
    setShowSpellCheckPreview(false);
    setSpellCheckResult(null);
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
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-xs text-muted-foreground">Content Preview:</p>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {getWordCount(sectionContent[section.id])} words
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTempContent(sectionContent[section.id]);
                              setShowPreview(true);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
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

      {/* Additional Notes Section - Mandatory 30 words */}
      <Card className="border-2 border-orange-200 bg-orange-50/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Additional Notes & Observations
            <Badge variant="destructive" className="text-xs">Required - 30 words minimum</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="additional-notes" className="text-sm font-medium">
              Please provide any additional observations, communications, or important details not covered above *
            </Label>
            <Textarea
              id="additional-notes"
              value={additionalNotes}
              onChange={(e) => {
                setAdditionalNotes(e.target.value);
                updateParent(selectedSections, sectionContent, e.target.value);
              }}
              placeholder="Include any additional observations, family communications, follow-up actions, or other relevant details not covered in the structured sections above..."
              className="mt-1 min-h-[100px]"
              rows={4}
            />
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs text-muted-foreground">
                Word count: {getWordCount(additionalNotes)} / 30 minimum
                {getWordCount(additionalNotes) >= 30 && (
                  <span className="text-green-600 ml-2">✓ Meets requirement</span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTempContent(additionalNotes);
                  setShowPreview(true);
                }}
                className="h-6 w-6 p-0"
                disabled={!additionalNotes.trim()}
              >
                <Eye className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSpellCheck}
                disabled={spellCheckCount >= 2 || spellCheckMutation.isPending || !additionalNotes.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Check Spelling
              </Button>
              <span className="text-sm text-muted-foreground">
                {2 - spellCheckCount} checks remaining
              </span>
            </div>
            
            {spellCheckMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                Checking spelling...
              </div>
            )}
          </div>

          {/* Spell Check Preview */}
          {showSpellCheckPreview && spellCheckResult && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Spell Check Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Corrected Version:</p>
                    <div className="bg-white p-3 rounded border text-sm">
                      {spellCheckResult.corrected}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={acceptSpellCheck}>
                      Accept Changes
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={rejectSpellCheck}>
                      Keep Original
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

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
                    {content?.trim() ? `${getWordCount(content)} words - ${content.substring(0, 50)}...` : "Content pending..."}
                  </span>
                </div>
              );
            })}
          </div>
          {additionalNotes && (
            <div className="text-sm mt-2">
              <span className="font-medium">Additional Notes:</span>{" "}
              <span className="text-muted-foreground">
                {getWordCount(additionalNotes)} words - {additionalNotes.substring(0, 50)}...
              </span>
            </div>
          )}
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
                Please provide detailed information for this section * (Minimum 30 words)
              </Label>
              <Textarea
                id="section-content"
                value={tempContent}
                onChange={(e) => setTempContent(e.target.value)}
                placeholder={currentSectionData?.placeholder}
                className="mt-1 min-h-[120px]"
                rows={6}
              />
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs text-muted-foreground">
                  Word count: {getWordCount(tempContent)} / 30 minimum
                  {getWordCount(tempContent) >= 30 && (
                    <span className="text-green-600 ml-2">✓ Meets requirement</span>
                  )}
                </div>
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
              disabled={!tempContent.trim() || getWordCount(tempContent) < 30}
            >
              Save Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Content Preview
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted/20 rounded-lg">
              <div className="whitespace-pre-wrap text-sm">
                {tempContent || "No content to preview"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Word count: {getWordCount(tempContent)} words
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="button" onClick={() => setShowPreview(false)}>
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}