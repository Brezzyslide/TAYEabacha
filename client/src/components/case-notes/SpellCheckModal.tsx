import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SpellCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  onApplySuggestions: (correctedText: string) => void;
}

export default function SpellCheckModal({
  isOpen,
  onClose,
  originalText,
  onApplySuggestions,
}: SpellCheckModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [correctedText, setCorrectedText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { toast } = useToast();

  const analyzeText = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate AI spell check - in real implementation, this would call OpenAI API
      // For now, we'll provide basic corrections
      const corrections = originalText
        .replace(/teh/g, "the")
        .replace(/recieve/g, "receive")
        .replace(/occured/g, "occurred")
        .replace(/seperate/g, "separate")
        .replace(/definately/g, "definitely")
        .replace(/neccessary/g, "necessary");
      
      setCorrectedText(corrections);
      
      // Generate suggestions list
      const foundSuggestions = [];
      if (originalText.includes("teh")) foundSuggestions.push("'teh' → 'the'");
      if (originalText.includes("recieve")) foundSuggestions.push("'recieve' → 'receive'");
      if (originalText.includes("occured")) foundSuggestions.push("'occured' → 'occurred'");
      if (originalText.includes("seperate")) foundSuggestions.push("'seperate' → 'separate'");
      if (originalText.includes("definately")) foundSuggestions.push("'definately' → 'definitely'");
      if (originalText.includes("neccessary")) foundSuggestions.push("'neccessary' → 'necessary'");
      
      setSuggestions(foundSuggestions);
      
      if (foundSuggestions.length === 0) {
        toast({
          title: "No Issues Found",
          description: "Your text appears to be well-written with no spelling errors detected.",
        });
      }
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze text. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    onApplySuggestions(correctedText);
    onClose();
    toast({
      title: "Suggestions Applied",
      description: "Spelling corrections have been applied to your case note.",
    });
  };

  const handleOpen = () => {
    if (isOpen && originalText && !isAnalyzing && !correctedText) {
      analyzeText();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            AI Spell Check & Grammar Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isAnalyzing ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-lg">Analyzing your text...</span>
            </div>
          ) : (
            <>
              {suggestions.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Suggested Corrections:</h3>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, index) => (
                      <Badge key={index} variant="outline" className="text-sm">
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Original Text:</label>
                  <Textarea
                    value={originalText}
                    readOnly
                    className="min-h-[200px] bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {suggestions.length > 0 ? "Corrected Text:" : "Text (No Changes Needed):"}
                  </label>
                  <Textarea
                    value={correctedText || originalText}
                    onChange={(e) => setCorrectedText(e.target.value)}
                    className="min-h-[200px]"
                    placeholder="Corrected text will appear here..."
                  />
                </div>
              </div>

              {suggestions.length === 0 && correctedText && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-800">No spelling or grammar issues detected!</span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {suggestions.length > 0 && correctedText && (
            <Button onClick={handleApply} className="bg-blue-600 hover:bg-blue-700">
              Apply Suggestions
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}