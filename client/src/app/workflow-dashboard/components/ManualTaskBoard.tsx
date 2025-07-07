import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { canCreateTasks } from "@/lib/permissions";
import { format } from "date-fns";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Trash2,
  MoreHorizontal,
  GripVertical
} from "lucide-react";

interface Task {
  id: number;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  dueDateTime?: string;
  assignedToUserId?: number;
  createdByUserId: number;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

const statusConfig = {
  "todo": { label: "To Do", color: "bg-gray-100 border-gray-300" },
  "in-progress": { label: "In Progress", color: "bg-blue-100 border-blue-300" },
  "done": { label: "Completed", color: "bg-green-100 border-green-300" }
};

export default function ManualTaskBoard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Fetch data with better stability
  const { data: tasks = [], isLoading, error } = useQuery<Task[]>({
    queryKey: ['/api/task-board-tasks'],
    staleTime: 30000, // Keep data fresh for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    retry: 3,
    retryDelay: 1000,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    staleTime: 60000, // Users change less frequently
    gcTime: 600000, // Keep in cache for 10 minutes
  });

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedToUserId: "",
    dueDateTime: null as Date | null,
  });

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const taskData = {
        ...data,
        status: "todo",
        assignedToUserId: data.assignedToUserId ? parseInt(data.assignedToUserId) : null,
      };
      return apiRequest('POST', '/api/task-board-tasks', taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-board-tasks'] });
      toast({ title: "Task created successfully" });
      setIsCreateModalOpen(false);
      setFormData({ title: "", description: "", assignedToUserId: "", dueDateTime: null });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: any }) => {
      return apiRequest('PUT', `/api/task-board-tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-board-tasks'] });
      toast({ title: "Task updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest('DELETE', `/api/task-board-tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-board-tasks'] });
      toast({ title: "Task deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete task", description: error.message, variant: "destructive" });
    },
  });

  // Group tasks by status
  const tasksByStatus = {
    "todo": tasks.filter(task => task.status === "todo"),
    "in-progress": tasks.filter(task => task.status === "in-progress"),
    "done": tasks.filter(task => task.status === "done"),
  };

  // Drag and drop handlers
  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      updateTaskMutation.mutate({
        taskId: draggedTask.id,
        updates: { status: newStatus }
      });
    }
    setDraggedTask(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    
    createTaskMutation.mutate(formData);
  };

  const getUserName = (userId?: number) => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.id === userId);
    return user ? (user.fullName || user.username) : "Unknown User";
  };

  // Error handling
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Badge variant="secondary">Error Loading Tasks</Badge>
          </div>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Failed to load task board. Please refresh the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Badge variant="secondary">Loading Tasks...</Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {["To Do", "In Progress", "Completed"].map((status) => (
            <Card key={status} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Badge variant="secondary">{tasks.length} Total Tasks</Badge>
          <Badge variant="outline">{tasksByStatus["todo"].length} To Do</Badge>
          <Badge variant="outline">{tasksByStatus["in-progress"].length} In Progress</Badge>
          <Badge variant="outline">{tasksByStatus["done"].length} Done</Badge>
        </div>
        
        {/* Only show Add Task button for roles with task creation permissions */}
        {canCreateTasks(user) && (
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description (optional)"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="assignedTo">Assign To</Label>
                <Select 
                  value={formData.assignedToUserId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignedToUserId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.fullName || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDateTime ? format(formData.dueDateTime, "PPP") : "Select date (optional)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dueDateTime || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, dueDateTime: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(statusConfig).map(([status, config]) => (
          <Card 
            key={status} 
            className={`${config.color} border-2`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{config.label}</span>
                <Badge variant="secondary">{tasksByStatus[status as keyof typeof tasksByStatus].length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasksByStatus[status as keyof typeof tasksByStatus].map((task) => (
                  <Card 
                    key={task.id} 
                    className="bg-white hover:shadow-md transition-shadow cursor-move"
                    draggable
                    onDragStart={() => handleDragStart(task)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-sm">{task.title}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="h-6 w-6 p-0 hover:bg-red-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {task.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{getUserName(task.assignedToUserId)}</span>
                          </div>
                          
                          {task.dueDateTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(task.dueDateTime), "MMM d")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {tasksByStatus[status as keyof typeof tasksByStatus].length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-sm">No tasks in {config.label.toLowerCase()}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}