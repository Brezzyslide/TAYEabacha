import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, CheckCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function CompanySummaryPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/admin/create-company")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Create Company
          </Button>
          
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">Company Created Successfully!</h1>
          </div>
          <p className="text-gray-600">Your new company has been registered and is ready for use.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>Company Details</span>
              </CardTitle>
              <CardDescription>
                Company registration information and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Company ID:</span>
                  <span className="text-sm text-gray-600 font-mono">
                    Generated automatically
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Registration Date:</span>
                  <span className="text-sm text-gray-600">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-600" />
                <span>Admin Account</span>
              </CardTitle>
              <CardDescription>
                Primary administrator account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Role:</span>
                  <Badge variant="default">Admin</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">First Login:</span>
                  <Badge variant="outline">Required</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Account Status:</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>
              What to do next to get your company up and running
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Log in with admin credentials</h4>
                  <p className="text-sm text-gray-600">Use the primary contact email and password to access the system</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Set up your organization</h4>
                  <p className="text-sm text-gray-600">Configure settings, add staff members, and customize the system</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Begin managing clients</h4>
                  <p className="text-sm text-gray-600">Start adding clients and using the care management features</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <Button 
                onClick={() => setLocation("/auth")}
                className="w-full"
              >
                Go to Login Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}