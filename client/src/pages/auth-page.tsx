import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { useLocation } from "wouter";
import { Building, Shield, Users, FileText } from "lucide-react";
import { useEffect } from "react";

const loginSchema = insertUserSchema.pick({ username: true, password: true });

type LoginData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, navigate] = useLocation();

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Redirect if already logged in using useEffect
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Return null while redirecting
  if (user) {
    return null;
  }

  const onLogin = (data: LoginData) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        navigate("/dashboard");
      }
    });
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Skip to content for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Left side - Professional hero section */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-md">
          <div className="mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
              <Building className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">NeedCareAI+</h1>
            <p className="text-xl text-blue-100 mb-6">
              Built with Positive Behaviour in Mind — not just Buttons.
            </p>
          </div>
          
          <div className="space-y-4 text-blue-100">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-300 rounded-full mt-2 flex-shrink-0"></div>
              <p>Care that starts with listening, not loading.</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-300 rounded-full mt-2 flex-shrink-0"></div>
              <p>NDIS reporting and compliance made easy.</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-300 rounded-full mt-2 flex-shrink-0"></div>
              <p>This system was designed by disability support workers — not tech bros.</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-300 rounded-full mt-2 flex-shrink-0"></div>
              <p>From shift to shift, we've got your back.</p>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-blue-400/30">
            <p className="text-sm text-blue-200 font-medium">
              Every Shift Structured & Safe • Participant-Centric Design
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center card-elevated">
                <Building className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">NeedCareAI+</h1>
            <p className="text-muted-foreground mt-2">Built with Positive Behaviour in Mind</p>
          </div>

          <Card className="card-elevated-lg border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-semibold text-foreground">Welcome to your NeedCareAI+ Workspace</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Sign in to access your care management platform
              </CardDescription>
            </CardHeader>
            <CardContent id="main-content" className="pt-6">
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="login-username" className="text-sm font-medium text-foreground">
                    Username or Email
                  </Label>
                  <Input
                    id="login-username"
                    {...loginForm.register("username")}
                    placeholder="Enter your username or email"
                    disabled={loginMutation.isPending}
                    className="h-11 text-base border-2 focus:border-primary transition-colors"
                    autoComplete="username"
                    required
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-destructive/10 flex items-center justify-center text-xs">!</span>
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    {...loginForm.register("password")}
                    placeholder="Enter your password"
                    disabled={loginMutation.isPending}
                    className="h-11 text-base border-2 focus:border-primary transition-colors"
                    autoComplete="current-password"
                    required
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-destructive/10 flex items-center justify-center text-xs">!</span>
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {loginMutation.isError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                    <p className="font-medium">Unable to sign in</p>
                    <p className="text-xs mt-1 opacity-90">Please check your credentials and try again</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium btn-gradient hover:shadow-lg transition-all duration-200" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Signing in...
                    </div>
                  ) : (
                    "Access Your Workspace"
                  )}
                </Button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-border/50 text-center">
                <p className="text-xs text-muted-foreground">
                  Secure access to your care management platform
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero section */}
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-600" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-primary-foreground">
          <h2 className="text-4xl font-bold mb-6">
            Streamline Your Care Management
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Secure, multi-tenant platform for healthcare facilities with advanced features for staff management and client care.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Role-Based Access</h3>
                <p className="opacity-80">Secure permissions for admin, staff, and viewer roles</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Staff Shift Tracking</h3>
                <p className="opacity-80">GPS-verified shift logging with real-time monitoring</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Dynamic Forms</h3>
                <p className="opacity-80">Custom form builder for assessments and intake processes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
