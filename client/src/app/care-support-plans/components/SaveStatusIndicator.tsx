import { Check, Loader2, AlertCircle, Clock } from "lucide-react";
import { useCarePlan } from "../contexts/CarePlanContext";
import { format } from "date-fns";

export function SaveStatusIndicator() {
  const { saveStatus, lastSaveTime } = useCarePlan();

  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'saved':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {lastSaveTime && (
        <span className="text-xs">
          at {format(lastSaveTime, 'HH:mm:ss')}
        </span>
      )}
    </div>
  );
}