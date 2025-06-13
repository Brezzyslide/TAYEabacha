import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Star, ChevronDown, ChevronUp, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface ObservationCardProps {
  observation: {
    id: number;
    clientId: number;
    observationType: string;
    subtype?: string;
    notes: string;
    timestamp: string | Date;
    intensity?: number;
    createdBy?: number;
  };
  clientName: string;
  onEdit?: (observation: any) => void;
  onDelete?: (observationId: number) => void;
  canEdit?: boolean;
}

export default function ObservationCard({ 
  observation, 
  clientName, 
  onEdit, 
  onDelete, 
  canEdit = false 
}: ObservationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "behaviour":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300";
      case "adl":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      case "health":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300";
      case "social":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300";
      case "communication":
        return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300";
    }
  };

  const renderIntensityStars = (intensity: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= intensity
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300 dark:text-gray-600"
            }`}
          />
        ))}
        <span className="text-xs text-gray-500 ml-1">({intensity}/5)</span>
      </div>
    );
  };

  const truncateNotes = (notes: string, maxLength: number = 120) => {
    if (notes.length <= maxLength) return notes;
    return notes.substring(0, maxLength) + "...";
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                {clientName}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${getTypeColor(observation.observationType)} border`}>
                {observation.observationType}
              </Badge>
              {observation.subtype && (
                <Badge variant="outline" className="text-xs">
                  {observation.subtype}
                </Badge>
              )}
            </div>
          </div>
          
          {canEdit && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(observation)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(observation.id)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Timestamp */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="h-4 w-4" />
          <span>{format(new Date(observation.timestamp), "MMM d, yyyy 'at' h:mm a")}</span>
        </div>

        {/* Intensity (for Behaviour observations) */}
        {observation.observationType.toLowerCase() === "behaviour" && observation.intensity && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Intensity:</span>
            {renderIntensityStars(observation.intensity)}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <div className="text-sm text-gray-800 dark:text-gray-200">
            {isExpanded ? observation.notes : truncateNotes(observation.notes)}
          </div>
          
          {observation.notes.length > 120 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show More
                </>
              )}
            </Button>
          )}
        </div>

        {/* Footer with metadata */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Observation #{observation.id}</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(observation.timestamp), "MMM d")}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}