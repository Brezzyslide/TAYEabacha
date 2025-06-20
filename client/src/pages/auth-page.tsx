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
    <div className="min-h-screen flex bg-gradient-to-br from-background via-muted to-accent/10">
      {/* Skip to content for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Left side - Sophisticated hero section with TUSK branding */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 bg-gradient-to-br from-primary via-primary/90 to-accent text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 backdrop-blur-3xl"></div>
        <div className="relative z-10 max-w-md">
          <div className="mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-secondary to-accent rounded-3xl flex items-center justify-center mb-8 shadow-2xl glass-effect">
              <span className="text-2xl font-bold text-white">AI+</span>
            </div>
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-secondary/80 bg-clip-text text-transparent">
              NeedCareAI+
            </h1>
            <p className="text-xl text-white/90 mb-8 font-medium">
              Built with Positive Behaviour in Mind — not just Buttons.
            </p>
          </div>
          
          <div className="space-y-6 text-white/90">
            <div className="flex items-start space-x-4">
              <div className="w-3 h-3 bg-gradient-to-r from-secondary to-accent rounded-full mt-2 flex-shrink-0 shadow-lg"></div>
              <p className="text-lg">Care that starts with listening, not loading.</p>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-3 h-3 bg-gradient-to-r from-secondary to-accent rounded-full mt-2 flex-shrink-0 shadow-lg"></div>
              <p className="text-lg">NDIS reporting and compliance made easy.</p>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-3 h-3 bg-gradient-to-r from-secondary to-accent rounded-full mt-2 flex-shrink-0 shadow-lg"></div>
              <p className="text-lg">This system was designed by disability support workers — not tech bros.</p>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-3 h-3 bg-gradient-to-r from-secondary to-accent rounded-full mt-2 flex-shrink-0 shadow-lg"></div>
              <p className="text-lg">From shift to shift, we've got your back.</p>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-white/20">
            <p className="text-sm text-white/80 font-semibold tracking-wide">
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

          <Card className="card-premium shadow-2xl border-0">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Welcome to your NeedCareAI+ Workspace
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground mt-4">
                Sign in to access your sophisticated care management platform
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
                    className="h-14 text-base border-2 focus:border-primary transition-all duration-300 rounded-2xl bg-white/50 backdrop-blur-sm focus:bg-white focus:shadow-lg"
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
                    className="h-14 text-base border-2 focus:border-primary transition-all duration-300 rounded-2xl bg-white/50 backdrop-blur-sm focus:bg-white focus:shadow-lg"
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
                  className="w-full h-16 text-lg font-semibold btn-gradient rounded-2xl tracking-wide" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <span className="bg-gradient-to-r from-white to-secondary/20 bg-clip-text text-transparent font-bold">
                      Access Your Workspace
                    </span>
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
