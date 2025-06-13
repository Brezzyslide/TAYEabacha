import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CompanyForm from "./components/CompanyForm";

export default function CreateCompanyPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
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
  );
}