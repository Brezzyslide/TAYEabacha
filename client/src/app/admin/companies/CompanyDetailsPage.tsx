import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowLeft, Users, Calendar, Phone, Mail, MapPin } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import type { Company } from "@shared/schema";

export default function CompanyDetailsPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/admin/companies/:id");
  const companyId = params?.id;

  const {
    data: companies = [],
    isLoading,
    error,
  } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const company = companies.find(c => c.id === companyId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-red-600">
                Failed to load company details: {error.message}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Company not found</h3>
                <p className="text-gray-600 mb-4">The requested company could not be found.</p>
                <Button onClick={() => setLocation("/admin/companies")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Companies
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/admin/companies")}
            className="flex items-center space-x-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Companies</span>
          </Button>
          
          <div className="flex items-center space-x-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-gray-600">Company Details & Management</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5" />
                <span>Company Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Company Name</label>
                <p className="text-lg font-semibold">{company.name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Registration Number</label>
                <p className="text-gray-900">{company.registrationNumber || "Not provided"}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Business Address</label>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                  <p className="text-gray-900">{company.businessAddress || "Not provided"}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">
                    {new Date(company.createdAt).toLocaleDateString('en-AU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Primary Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Primary Contact</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Contact Name</label>
                <p className="text-lg font-semibold">{company.primaryContactName || "Not provided"}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Email Address</label>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{company.primaryContactEmail || "Not provided"}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Phone Number</label>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{company.primaryContactPhone || "Not provided"}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Management Actions</CardTitle>
            <CardDescription>
              Available actions for this company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" disabled>
                View Staff
              </Button>
              <Button variant="outline" disabled>
                View Billing
              </Button>
              <Button variant="outline" disabled>
                Company Settings
              </Button>
              <Button variant="destructive" disabled>
                Suspend Company
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Management features are under development and will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}