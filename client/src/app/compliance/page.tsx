import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { hasPermission } from "@/lib/permissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  FileText, 
  Download, 
  Edit, 
  Search,
  Filter,
  Shield,
  Lock,
  Eye,
  ExternalLink,
  Users,
  FileCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";

export default function CompliancePage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  // Get current user data for permission checking
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Check if user has access to compliance module
  if (user && !hasPermission(user, "ACCESS_COMPLIANCE")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
              Access Restricted
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              Only Admin and Program Coordinators can access the Compliance module.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
          <Shield className="h-3 w-3 mr-1" />
          Your role: {user?.role || "Unknown"}
        </Badge>
      </div>
    );
  }

  // Query for service agreements
  const { data: agreements = [], isLoading: agreementsLoading } = useQuery({
    queryKey: ["/api/compliance/service-agreements"],
  });

  // Query for referral submissions
  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["/api/referrals"],
  });

  // Query for referral links
  const { data: referralLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ["/api/compliance/referral-links"],
  });

  // Query for invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/invoices"],
  });

  const getAgreementStatus = (agreement: any) => {
    const now = new Date();
    const startDate = new Date(agreement.startDate);
    const endDate = new Date(agreement.endDate);
    
    if (now < startDate) return "Pending";
    if (now > endDate) return "Expired";
    return "Active";
  };

  const getReferralStatus = (referral: any) => {
    return referral.status || "pending";
  };

  const complianceModules = [
    {
      id: "service-agreements",
      title: "Service Agreements",
      description: "Manage NDIS service agreements with digital signatures",
      icon: FileCheck,
      count: Array.isArray(agreements) ? agreements.length : 0,
      href: "/compliance/service-agreements",
      status: "operational",
      lastUpdate: agreements.length > 0 ? agreements[0]?.updatedAt : null,
      color: "blue"
    },
    {
      id: "referral-management",
      title: "Referral Management",
      description: "Process and assess NDIS participant referrals",
      icon: Users,
      count: Array.isArray(referrals) ? referrals.length : 0,
      href: "/compliance/referral-management",
      status: "operational",
      lastUpdate: referrals.length > 0 ? referrals[0]?.submittedAt : null,
      color: "green"
    },
    {
      id: "referral-links",
      title: "NDIS Referral Links",
      description: "Create and manage public referral form links",
      icon: ExternalLink,
      count: Array.isArray(referralLinks) ? referralLinks.length : 0,
      href: "/compliance/referral-links",
      status: "operational",
      lastUpdate: referralLinks.length > 0 ? referralLinks[0]?.createdAt : null,
      color: "purple"
    },
    {
      id: "invoices",
      title: "NDIS Invoices",
      description: "Create and manage NDIS-compliant invoices with automated pricing",
      icon: FileText,
      count: Array.isArray(invoices) ? invoices.length : 0,
      href: "/compliance/invoices",
      status: "operational",
      lastUpdate: Array.isArray(invoices) && invoices.length > 0 ? invoices[0]?.createdAt : null,
      color: "orange"
    }
  ];

  const filteredModules = complianceModules.filter((module) => {
    const matchesModule = moduleFilter === "all" || module.id === moduleFilter;
    const matchesStatus = statusFilter === "all" || module.status === statusFilter;
    const matchesSearch = !searchTerm || 
      module.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesModule && matchesStatus && matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge variant="default" className="bg-green-100 text-green-800">Operational</Badge>;
      case "warning":
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getModuleColor = (color: string) => {
    switch (color) {
      case "blue":
        return "border-blue-200 bg-blue-50/50 hover:bg-blue-100/50";
      case "green":
        return "border-green-200 bg-green-50/50 hover:bg-green-100/50";
      case "purple":
        return "border-purple-200 bg-purple-50/50 hover:bg-purple-100/50";
      default:
        return "border-gray-200 bg-gray-50/50 hover:bg-gray-100/50";
    }
  };

  const isLoading = agreementsLoading || referralsLoading || linksLoading;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Compliance Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage NDIS compliance modules and service documentation
          </p>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="service-agreements">Service Agreements</SelectItem>
                <SelectItem value="referral-management">Referral Management</SelectItem>
                <SelectItem value="referral-links">Referral Links</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Modules Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Modules ({filteredModules.length})</CardTitle>
          <CardDescription>
            Access and manage compliance modules for NDIS service delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading modules...</div>
          ) : filteredModules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {complianceModules.length === 0 
                ? "No compliance modules available."
                : "No modules match your current filters."
              }
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModules.map((module) => (
                <Link key={module.id} href={module.href}>
                  <Card className={`transition-all duration-200 hover:shadow-md cursor-pointer ${getModuleColor(module.color)}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-white border shadow-sm`}>
                            <module.icon className="h-5 w-5 text-gray-700" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{module.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusIcon(module.status)}
                              {getStatusBadge(module.status)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {module.description}
                      </p>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{module.count} items</span>
                        </div>
                        {module.lastUpdate && (
                          <span className="text-muted-foreground">
                            {format(new Date(module.lastUpdate), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(agreements) ? agreements.filter(a => getAgreementStatus(a) === "Active").length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {Array.isArray(agreements) ? agreements.length : 0} total agreements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(referrals) ? referrals.filter(r => getReferralStatus(r) === "pending").length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {Array.isArray(referrals) ? referrals.length : 0} total referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(referralLinks) ? referralLinks.filter(l => l.status === "active").length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {Array.isArray(referralLinks) ? referralLinks.length : 0} total links
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}