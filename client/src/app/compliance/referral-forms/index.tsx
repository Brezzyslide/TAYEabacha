import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, Eye, Edit, Share2, Users } from "lucide-react";
import { format } from "date-fns";

interface ReferralForm {
  id: number;
  formType: string;
  title: string;
  description?: string;
  isActive: boolean;
  requiresApproval: boolean;
  allowMultipleSubmissions: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export default function ReferralFormsIndex() {
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: forms, isLoading } = useQuery({
    queryKey: ["/api/compliance/referral-forms"],
  });

  const getFormTypeColor = (type: string) => {
    switch (type) {
      case "medical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "therapy": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "assessment": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "support": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referral Forms</h1>
          <p className="text-muted-foreground">
            Create and manage shareable referral forms for third-party submissions
          </p>
        </div>
        <Link href="/compliance/referral-forms/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Forms</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{forms?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Forms</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {forms?.filter((f: ReferralForm) => f.isActive).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {forms?.filter((f: ReferralForm) => f.requiresApproval).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Form Types</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(forms?.map((f: ReferralForm) => f.formType)).size || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forms Grid */}
      {(!forms || forms.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Share2 className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No referral forms yet</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Create your first referral form to start collecting submissions from third parties.
            </p>
            <Link href="/compliance/referral-forms/create">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Form
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form: ReferralForm) => (
            <Card key={form.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <Badge className={getFormTypeColor(form.formType)}>
                      {form.formType}
                    </Badge>
                    <CardTitle className="text-lg">{form.title}</CardTitle>
                    {form.description && (
                      <CardDescription className="line-clamp-2">
                        {form.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    {form.isActive ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-600 border-gray-600">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Created by {form.createdBy}</span>
                    <span>{format(new Date(form.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  
                  <div className="flex space-x-1">
                    {form.requiresApproval && (
                      <Badge variant="outline" className="text-xs">
                        Requires Approval
                      </Badge>
                    )}
                    {form.allowMultipleSubmissions && (
                      <Badge variant="outline" className="text-xs">
                        Multiple Submissions
                      </Badge>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Link href={`/compliance/referral-forms/view/${form.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Link href={`/compliance/referral-forms/edit/${form.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}