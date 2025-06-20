import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "@shared/schema";
import { UserCircle, Mail, Shield, Plus, Search, Edit, UserPlus, Key, Phone, MapPin, Upload, ImageIcon, FileText, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Label } from "@/components/ui/label";

const createStaffSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SupportWorker", "TeamLeader", "Coordinator", "Admin", "ConsoleManager"]),
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CreateStaffFormData = z.infer<typeof createStaffSchema>;

const editStaffSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().optional(),
  role: z.enum(["SupportWorker", "TeamLeader", "Coordinator", "Admin", "ConsoleManager"]),
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
});

type EditStaffFormData = z.infer<typeof editStaffSchema>;

// Staff Bulk Upload Component
function StaffBulkUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [templateFormat, setTemplateFormat] = useState<'csv' | 'excel'>('csv');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const downloadTemplate = (format: 'csv' | 'excel' = templateFormat) => {
    const headers = ["username", "email", "password", "role", "fullName", "phone", "address"];
    const sampleData = ["example.user", "user@example.com", "password123", "SupportWorker", "John Doe", "1234567890", "123 Main St"];
    
    if (format === 'csv') {
      const csvContent = `${headers.join(',')}\n${sampleData.join(',')}`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'staff_upload_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      // Create Excel file
      const ws = XLSX.utils.aoa_to_sheet([headers, sampleData]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Staff Template");
      XLSX.writeFile(wb, "staff_upload_template.xlsx");
    }
  };

  const parseFileData = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let parsedData: any[] = [];
          
          if (file.name.endsWith('.csv')) {
            // Parse CSV
            const text = data as string;
            const lines = text.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim());
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim());
              if (values.length === headers.length) {
                const row: any = {};
                headers.forEach((header, index) => {
                  row[header] = values[index];
                });
                parsedData.push(row);
              }
            }
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // Parse Excel
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            parsedData = XLSX.utils.sheet_to_json(worksheet);
          }
          
          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a CSV or Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const parsedData = await parseFileData(file);
      
      if (parsedData.length === 0) {
        throw new Error("No valid data found in file");
      }

      // Send parsed data to backend
      const response = await apiRequest("POST", "/api/staff/bulk-upload", { data: parsedData });
      
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({
        title: "Success",
        description: `${parsedData.length} staff members processed successfully`,
      });
      setFile(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload staff members",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Download Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Choose template format and download</p>
        </div>
        
        <div className="flex gap-3">
          <div className="flex-1">
            <Select value={templateFormat} onValueChange={(value: 'csv' | 'excel') => setTemplateFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV Template
                  </div>
                </SelectItem>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Template
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => downloadTemplate(templateFormat)}>
            Download {templateFormat.toUpperCase()}
          </Button>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {file?.name.endsWith('.xlsx') || file?.name.endsWith('.xls') ? (
                <FileSpreadsheet className="h-12 w-12 text-green-500" />
              ) : (
                <FileText className="h-12 w-12 text-blue-500" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {file ? file.name : "Click to select CSV or Excel file"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Supports .csv, .xlsx, and .xls files
            </p>
          </div>
        </label>
      </div>

      {/* Upload Button */}
      <Button 
        onClick={handleFileUpload} 
        disabled={!file || isUploading}
        className="w-full"
        size="lg"
      >
        {isUploading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Processing {file?.name.endsWith('.xlsx') || file?.name.endsWith('.xls') ? 'Excel' : 'CSV'} file...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Staff Data
          </div>
        )}
      </Button>
    </div>
  );
}

// Company Logo Upload Component
function CompanyLogoUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleLogoUpload = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select an image file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      await apiRequest("POST", "/api/company/logo", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({
        title: "Success",
        description: "Company logo uploaded successfully",
      });
      setFile(null);
      setPreview(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Upload a PNG, JPG, or SVG file for your company logo</p>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="logo-upload"
        />
        <label htmlFor="logo-upload" className="cursor-pointer">
          <div className="text-center">
            {preview ? (
              <img src={preview} alt="Logo preview" className="mx-auto h-24 w-24 object-contain" />
            ) : (
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
            )}
            <p className="mt-2 text-sm text-gray-600">
              {file ? file.name : "Click to select logo image"}
            </p>
          </div>
        </label>
      </div>

      <Button 
        onClick={handleLogoUpload} 
        disabled={!file || isUploading}
        className="w-full"
      >
        {isUploading ? "Uploading..." : "Upload Company Logo"}
      </Button>
    </div>
  );
}

// EditStaffForm component
function EditStaffForm({ 
  staff, 
  onSubmit, 
  isLoading 
}: { 
  staff: User; 
  onSubmit: (data: Partial<User>) => void; 
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    username: staff.username,
    email: staff.email || "",
    role: staff.role,
    fullName: staff.fullName || "",
    phone: staff.phone || "",
    address: staff.address || "",
    isActive: staff.isActive || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className="mt-1"
        />
      </div>
      
      <div>
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="role">Role</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SupportWorker">Support Worker</SelectItem>
            <SelectItem value="TeamLeader">Team Leader</SelectItem>
            <SelectItem value="Coordinator">Coordinator</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="ConsoleManager">Console Manager</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="mt-1"
            placeholder="Enter phone number"
          />
        </div>
        
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="mt-1"
            placeholder="Enter address"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="isActive" className="text-sm font-normal">
          Active Status
        </Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update Staff"}
        </Button>
      </div>
    </form>
  );
}

export default function Staff() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordStaff, setResetPasswordStaff] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: staff, isLoading } = useQuery<User[]>({
    queryKey: ["/api/staff"],
  });

  const form = useForm<CreateStaffFormData>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "SupportWorker",
      fullName: "",
      phone: "",
      address: "",
      isActive: true,
    },
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: CreateStaffFormData) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setIsCreateOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Staff member created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create staff member",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateStaffFormData) => {
    createStaffMutation.mutate(data);
  };

  // Edit staff mutation
  const editStaffMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<User> }) => {
      return apiRequest("PUT", `/api/staff/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setIsEditOpen(false);
      setEditingStaff(null);
      toast({
        title: "Success",
        description: "Staff member updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff member",
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { id: number; newPassword: string }) => {
      return apiRequest("POST", `/api/staff/${data.id}/reset-password`, { newPassword: data.newPassword });
    },
    onSuccess: () => {
      setIsResetPasswordOpen(false);
      setResetPasswordStaff(null);
      setNewPassword("");
      toast({
        title: "Success",
        description: "Password reset successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  // Handler functions
  const handleEditStaff = (staff: User) => {
    setEditingStaff(staff);
    setIsEditOpen(true);
  };

  const handleResetPassword = (staff: User) => {
    setResetPasswordStaff(staff);
    setIsResetPasswordOpen(true);
  };

  const handleEditSubmit = (updates: Partial<User>) => {
    if (editingStaff) {
      editStaffMutation.mutate({ id: editingStaff.id, updates });
    }
  };

  const handlePasswordReset = () => {
    if (resetPasswordStaff && newPassword.trim()) {
      resetPasswordMutation.mutate({ 
        id: resetPasswordStaff.id, 
        newPassword: newPassword.trim() 
      });
    }
  };

  // Filter staff based on search term
  const filteredStaff = staff?.filter(member =>
    member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    member.role.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "staff":
        return "default";
      case "viewer":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "staff":
        return <UserCircle className="h-4 w-4" />;
      case "viewer":
        return <UserCircle className="h-4 w-4" />;
      default:
        return <UserCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">View and manage your team members</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 w-full sm:w-auto">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Create </span>Staff
              </Button>
            </DialogTrigger>
          </Dialog>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk </span>Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Bulk Staff Upload</DialogTitle>
                <DialogDescription>
                  Upload a CSV file to create multiple staff members at once. Download the template first.
                </DialogDescription>
              </DialogHeader>
              <StaffBulkUploadForm />
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Company </span>Logo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Upload Company Logo</DialogTitle>
                <DialogDescription>
                  Upload your company's custom logo for white-labeling. This will replace the default fan blade logo.
                </DialogDescription>
              </DialogHeader>
              <CompanyLogoUploadForm />
            </DialogContent>
          </Dialog>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Staff Member</DialogTitle>
              <DialogDescription>
                Add a new team member to your organization with their credentials and role assignment.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SupportWorker">Support Worker</SelectItem>
                          <SelectItem value="TeamLeader">Team Leader</SelectItem>
                          <SelectItem value="Coordinator">Coordinator</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="ConsoleManager">Console Manager</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createStaffMutation.isPending}>
                    {createStaffMutation.isPending ? "Creating..." : "Create Staff"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-xl sm:text-3xl font-bold text-gray-900">{staff?.length || 0}</p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserCircle className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Active Staff</p>
                <p className="text-xl sm:text-3xl font-bold text-gray-900">
                  {staff?.filter(s => s.isActive).length || 0}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCircle className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Administrators</p>
                <p className="text-xl sm:text-3xl font-bold text-gray-900">
                  {staff?.filter(s => ['Admin', 'ConsoleManager'].includes(s.role)).length || 0}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 sm:h-6 sm:w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <CardTitle className="text-lg sm:text-xl">Staff Directory</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading staff...</div>
          ) : filteredStaff && filteredStaff.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          {getRoleIcon(member.role)}
                        </div>
                        <span>{member.fullName || member.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{member.email || "No email"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{member.phone || "No phone"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{member.address || "No address"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleColor(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <PermissionGuard module="staff" action="edit">
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStaff(member)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <PermissionGuard module="staff" action="reset-password">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(member)}
                              className="h-8 w-8 p-0"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>
                        </div>
                      </PermissionGuard>
                    </TableCell>
                  </TableRow>
                ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {filteredStaff.map((member) => (
                  <Card key={member.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          {getRoleIcon(member.role)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{member.fullName || member.username}</h3>
                          <Badge variant={getRoleColor(member.role)} className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant={member.isActive ? "default" : "secondary"} className="text-xs">
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{member.email || "No email"}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.address && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{member.address}</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Joined: {new Date(member.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <PermissionGuard module="staff" action="edit">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditStaff(member)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <PermissionGuard module="staff" action="reset-password">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetPassword(member)}
                            className="flex-1"
                          >
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                          </Button>
                        </PermissionGuard>
                      </div>
                    </PermissionGuard>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">No staff members found</div>
          )}
        </CardContent>
      </Card>

      {/* Edit Staff Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update staff member information
            </DialogDescription>
          </DialogHeader>
          {editingStaff && (
            <EditStaffForm 
              staff={editingStaff} 
              onSubmit={handleEditSubmit}
              isLoading={editStaffMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {resetPasswordStaff?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsResetPasswordOpen(false);
                  setNewPassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordReset}
                disabled={!newPassword.trim() || resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}