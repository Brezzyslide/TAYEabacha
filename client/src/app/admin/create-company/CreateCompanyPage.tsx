import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import CompanyForm from "./components/CompanyForm";

export default function CreateCompanyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="outline" 
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/auth")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Login Page</span>
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Company</h1>
            <p className="text-gray-600 mt-2">Register a new company and set up the primary administrator account.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Company Registration</CardTitle>
              <CardDescription>
                Enter the company details and primary contact information to create a new organization in the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}