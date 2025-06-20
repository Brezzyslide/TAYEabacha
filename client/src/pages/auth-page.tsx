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
    <div className="min-h-screen flex">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">NeedCareAI+</h1>
            <p className="text-gray-600 mt-2">Welcome to NeedCareAI+</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div>
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    {...loginForm.register("username")}
                    placeholder="Enter your username"
                    disabled={loginMutation.isPending}
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    {...loginForm.register("password")}
                    placeholder="Enter your password"
                    disabled={loginMutation.isPending}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - NeedCareAI+ Messaging */}
      <div className="hidden lg:flex flex-1 bg-[#0c1e35] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1e35] to-[#132f54]" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <h2 className="text-4xl font-bold mb-6">
            Built with Positive Behaviour in Mind — not just Buttons.
          </h2>
          
          <div className="space-y-6 mb-8">
            <p className="text-xl opacity-90">
              Care that starts with listening, not loading.
            </p>
            <p className="text-xl opacity-90">
              NDIS reporting and compliance made easy.
            </p>
            <p className="text-xl opacity-90">
              This system was designed by disability support workers — not tech bros.
            </p>
            <p className="text-xl opacity-90">
              From shift to shift, we've got your back.
            </p>
          </div>
          
          <div className="border-t border-white/20 pt-6">
            <p className="text-lg font-semibold opacity-95">
              Every Shift Structured & Safe • Participant-Centric Design
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
