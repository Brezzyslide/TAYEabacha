import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { useLocation } from "wouter";

export default function FormBuilderPreview() {
  const [, navigate] = useLocation();

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Dynamic Form Builder</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary hover:text-primary/80"
            onClick={() => navigate("/forms")}
          >
            Open Builder
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Form Preview */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">Client Intake Form Preview</h4>
          
          <div className="space-y-3">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </Label>
              <Input 
                type="text" 
                placeholder="Enter client's full name" 
                className="w-full"
                disabled
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </Label>
                <Input 
                  type="date" 
                  className="w-full"
                  disabled
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </Label>
                <Input 
                  type="tel" 
                  placeholder="(555) 123-4567" 
                  className="w-full"
                  disabled
                />
              </div>
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Care Level
              </Label>
              <Select disabled>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select care level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="independent">Independent</SelectItem>
                  <SelectItem value="assisted">Assisted</SelectItem>
                  <SelectItem value="memory_care">Memory Care</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Contact
              </Label>
              <Textarea 
                placeholder="Contact information and relationship" 
                rows={2} 
                className="w-full"
                disabled
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Info className="h-4 w-4" />
            <span>5 fields • Auto-save enabled</span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/forms")}
          >
            Edit Form
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
