import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Building2, User, Mail, Phone, Lock, FileText } from "lucide-react";
import TenantProvisioningToggle from "./TenantProvisioningToggle";

const createCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  businessAddress: z.string().optional(),
  registrationNumber: z.string().optional(),
  primaryContactName: z.string().min(1, "Primary contact name is required"),
  primaryContactEmail: z.string().email("Invalid email address"),
  primaryContactPhone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  includeDemoData: z.boolean().default(true),
});

type CreateCompanyFormData = z.infer<typeof createCompanySchema>;

export default function CompanyForm() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<CreateCompanyFormData>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      companyName: "",
      businessAddress: "",
      registrationNumber: "",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      password: "",
      includeDemoData: true,
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CreateCompanyFormData) => {
      const response = await apiRequest("POST", "/api/admin/create-company", data);
      return response.json();
    },
    onSuccess: (data) => {
      console.table([
        {
          companyId: data.company.id,
          companyName: data.company.name,
          adminUserId: data.admin.id,
          adminEmail: data.admin.email,
          status: "Created Successfully"
        }
      ]);
      
      toast({
        title: "Company Created Successfully",
        description: `${data.company.name} has been registered with ID: ${data.company.id}`,
      });
      
      setLocation("/admin/company-summary");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateCompanyFormData) => {
    createCompanyMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Company Information Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
          </div>

          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter company name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="businessAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Address</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter business address (optional)"
                    className="min-h-[80px]"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="registrationNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ABN or Registration Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter ABN or registration number (optional)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Primary Contact Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <User className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Primary Contact Information</h3>
          </div>

          <FormField
            control={form.control}
            name="primaryContactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryContactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Email *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter email address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryContactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Phone</FormLabel>
                <FormControl>
                  <Input placeholder="Enter phone number (optional)" {...field} />
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
                <FormLabel>Create Password *</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Enter password (min 8 characters)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Demo Data Toggle */}
        <TenantProvisioningToggle 
          includeDemoData={form.watch("includeDemoData")}
          onToggle={(value) => form.setValue("includeDemoData", value)}
        />

        {/* Submit Button */}
        <div className="pt-6 border-t">
          <Button 
            type="submit" 
            className="w-full"
            disabled={createCompanyMutation.isPending}
          >
            {createCompanyMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating Company...
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 mr-2" />
                Create Company
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}