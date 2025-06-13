import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Edit, Trash2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface ObservationRowProps {
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
  isLast?: boolean;
  onEdit?: (observation: any) => void;
  onDelete?: (observationId: number) => void;
  canEdit?: boolean;
}

export default function ObservationRow({ 
  observation, 
  clientName, 
  isLast = false,
  onEdit, 
  onDelete, 
  canEdit = false 
}: ObservationRowProps) {
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

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className={`${!isLast ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>
      <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center justify-between">
          {/* Main Content */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            {/* Client Name */}
            <div className="md:col-span-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {clientName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ID: {observation.clientId}
              </div>
            </div>

            {/* Type & Subtype */}
            <div className="md:col-span-1">
              <Badge className={`${getTypeColor(observation.observationType)} border text-xs`}>
                {observation.observationType}
              </Badge>
              {observation.subtype && (
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs">
                    {observation.subtype}
                  </Badge>
                </div>
              )}
            </div>

            {/* Timestamp */}
            <div className="md:col-span-1">
              <div className="text-sm text-gray-900 dark:text-white">
                {format(new Date(observation.timestamp), "MMM d, yyyy")}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format(new Date(observation.timestamp), "h:mm a")}
              </div>
            </div>

            {/* Intensity (for Behaviour) */}
            <div className="md:col-span-1">
              {observation.observationType.toLowerCase() === "behaviour" && observation.intensity ? (
                renderIntensityStars(observation.intensity)
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </div>

            {/* Notes Preview */}
            <div className="md:col-span-2">
              <div className="text-sm text-gray-800 dark:text-gray-200">
                {isExpanded ? observation.notes : truncateText(observation.notes)}
              </div>
              {observation.notes.length > 80 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-5 px-2 text-xs text-blue-600 hover:text-blue-700 mt-1"
                >
                  {isExpanded ? "Show Less" : "Show More"}
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            {canEdit && (
              <>
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
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight 
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              />
            </Button>
          </div>
        </div>

        {/* Expanded Notes */}
        {isExpanded && observation.notes.length > 80 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              {observation.notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}