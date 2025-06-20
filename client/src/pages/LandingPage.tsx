import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import needCareAILogo from "../../../attached_assets/ChatGPT Image Jun 19, 2025, 09_40_28 AM_1750290306428.png";

const floatingMessages = [
  "Built by and for people who do the work — not tech bros.",
  "PBS in every button — not just every plan.",
  "Every shift structured. Every life supported.",
  "NDIS-ready. Compliance isn't a feature — it's the foundation.",
  "Supports NDIS funding applications with evidence-backed care design.",
  "Made for staff. Trusted by coordinators. Loved by participants."
];

export default function LandingPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("about");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: ""
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message sent",
      description: "Your message has been sent. We'll be in touch shortly."
    });
    setContactForm({ name: "", email: "", message: "" });
  };

  const FloatingBubble = ({ text, delay }: { text: string; delay: number }) => (
    <motion.div
      initial={{ opacity: 0, x: -100, y: 100 }}
      animate={{
        opacity: [0, 0.7, 0],
        x: [0, 200, 400],
        y: [0, -50, -100]
      }}
      transition={{
        duration: 20,
        delay,
        repeat: Infinity,
        ease: "linear"
      }}
      className="absolute hidden lg:block text-sm text-white/80 bg-secondary/20 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/20 pointer-events-none z-0 shadow-xl"
    >
      {text}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-accent text-white relative overflow-hidden">
      {/* Floating Message Bubbles */}
      <div className="fixed inset-0 pointer-events-none">
        {floatingMessages.map((message, index) => (
          <FloatingBubble
            key={index}
            text={message}
            delay={index * 3}
          />
        ))}
      </div>

      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-primary/95 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-secondary to-accent rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                <span className="text-white font-bold text-lg drop-shadow-md">AI+</span>
              </div>
              <h1 className="text-2xl font-bold text-white drop-shadow-md">NeedsCareAI+</h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {[
                { id: "about", label: "About Us" },
                { id: "demo", label: "Book a Demo" },
                { id: "philosophy", label: "Our Philosophy" },
                { id: "pricing", label: "Pricing" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-secondary to-accent text-white shadow-xl"
                      : "text-white/80 hover:text-white hover:bg-white/10 hover:shadow-lg"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Desktop Login Button */}
            <a href="/auth">
              <Button
                variant="outline"
                className="hidden md:flex border-secondary text-secondary hover:bg-secondary hover:text-white rounded-2xl px-6 py-3 font-medium shadow-lg transition-all duration-300"
              >
                Login
              </Button>
            </a>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-2"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-primary/90 border-t border-white/20 backdrop-blur-sm">
            <div className="px-6 py-4 space-y-4">
              {[
                { id: "about", label: "About Us" },
                { id: "demo", label: "Book a Demo" },
                { id: "philosophy", label: "Our Philosophy" },
                { id: "pricing", label: "Pricing" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-secondary to-accent text-white shadow-xl"
                      : "text-white/80 hover:text-white hover:bg-white/10 hover:shadow-lg"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <a href="/auth" className="block">
                <Button
                  variant="outline"
                  className="w-full border-secondary text-secondary hover:bg-secondary hover:text-white rounded-2xl py-3 font-medium shadow-lg transition-all duration-300"
                >
                  Login
                </Button>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent drop-shadow-lg">
              NeedsCareAI+
            </h1>
            <p className="text-xl text-white/90 mb-8 font-medium">
              Comprehensive Care Management Platform
            </p>
          </motion.div>

          {/* Strategic Message Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-gradient-to-br from-white/10 via-secondary/10 to-accent/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 mb-12 shadow-2xl"
          >
            <blockquote className="text-lg leading-relaxed text-amber-50 italic font-bold drop-shadow-2xl">
              "NeedsCareAI+ was built by disability support workers, not tech bros.
              It aggressively incorporates Positive Behaviour Support principles to help participants stay regulated, live with dignity, and reach their goals.
              This platform doesn't just look compliant — it thinks like a practitioner."
            </blockquote>
          </motion.div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="relative z-10 py-16 px-6">
        <div className="container mx-auto max-w-6xl">
          {activeTab === "about" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-2 gap-8"
            >
              <Card className="bg-gradient-to-br from-white/10 via-secondary/5 to-accent/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-secondary font-bold text-xl">Built for Practitioners</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-50 font-bold drop-shadow-2xl text-lg">
                    Created by support workers who understand the daily challenges of disability care.
                    Every feature is designed with real-world practice in mind.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white/10 via-accent/5 to-secondary/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-accent font-bold text-xl">NDIS Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-emerald-50 font-bold drop-shadow-2xl text-lg">
                    Built-in compliance features ensure your documentation meets NDIS standards
                    and supports funding applications with evidence-backed care design.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white/10 via-secondary/5 to-accent/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-secondary font-bold text-xl">Positive Behaviour Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-50 font-bold drop-shadow-2xl text-lg">
                    PBS principles are integrated throughout the platform, not just in care plans.
                    Every interaction is designed to support participant regulation and dignity.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white/10 via-accent/5 to-secondary/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-accent font-bold text-xl">Comprehensive Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-emerald-50 font-bold drop-shadow-2xl text-lg">
                    From shift management to care planning, medication tracking to incident reporting.
                    Everything you need in one integrated platform.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "demo" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <Card className="bg-gradient-to-br from-white/10 via-secondary/10 to-accent/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-secondary font-bold text-2xl">Book a Demo</CardTitle>
                  <CardDescription className="text-white/90 font-medium">
                    See NeedsCareAI+ in action with a personalized demonstration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-50 mb-6 font-bold drop-shadow-2xl text-lg">
                    Our team will walk you through the platform's features and show you how
                    it can transform your care management processes.
                  </p>
                  <Button className="bg-gradient-to-r from-secondary to-accent hover:shadow-xl rounded-2xl px-8 py-3 font-bold transition-all duration-300">
                    Schedule Demo
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "philosophy" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              <Card className="bg-gradient-to-br from-white/10 via-secondary/10 to-accent/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-secondary font-bold text-2xl text-center">Our Philosophy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-amber-50">
                  <div>
                    <h3 className="text-xl font-bold text-secondary mb-3 drop-shadow-2xl">Person-Centered Design</h3>
                    <p className="font-bold drop-shadow-2xl text-lg">Every feature is built with the participant at the center. Technology should enhance human connection, not replace it.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-accent mb-3 drop-shadow-2xl">Practitioner-Led Development</h3>
                    <p className="font-bold drop-shadow-2xl text-lg">Built by support workers who understand the reality of care delivery. No ivory tower solutions here.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary mb-3 drop-shadow-2xl">Evidence-Based Practice</h3>
                    <p className="font-bold drop-shadow-2xl text-lg">Every interaction supports evidence collection for better outcomes and NDIS compliance.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-accent mb-3 drop-shadow-2xl">Dignity in Technology</h3>
                    <p className="font-bold drop-shadow-2xl text-lg">Technology that respects the dignity of both participants and support workers in every interaction.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "pricing" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-3 gap-8"
            >
              <Card className="bg-gradient-to-br from-white/10 via-secondary/5 to-accent/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-secondary font-bold text-xl">Starter</CardTitle>
                  <CardDescription className="text-white/90 font-medium">Perfect for small teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-100 mb-4 drop-shadow-lg">$29/month</div>
                  <ul className="text-emerald-100 space-y-2 font-semibold drop-shadow-lg">
                    <li>• Up to 10 participants</li>
                    <li>• Basic shift management</li>
                    <li>• Care plan templates</li>
                    <li>• Email support</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white/15 via-accent/10 to-secondary/15 border-secondary/50 border-2 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-accent font-bold text-xl">Professional</CardTitle>
                  <CardDescription className="text-amber-100 font-semibold drop-shadow-lg">Most popular choice</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-100 mb-4 drop-shadow-lg">$79/month</div>
                  <ul className="text-emerald-100 space-y-2 font-semibold drop-shadow-lg">
                    <li>• Unlimited participants</li>
                    <li>• Advanced analytics</li>
                    <li>• AI-powered insights</li>
                    <li>• Priority support</li>
                    <li>• NDIS compliance tools</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white/10 via-accent/5 to-secondary/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-accent font-bold text-xl">Enterprise</CardTitle>
                  <CardDescription className="text-amber-100 font-semibold drop-shadow-lg">For large organizations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-100 mb-4 drop-shadow-lg">Custom</div>
                  <ul className="text-emerald-100 space-y-2 font-semibold drop-shadow-lg">
                    <li>• Multi-site management</li>
                    <li>• Custom integrations</li>
                    <li>• Dedicated support</li>
                    <li>• Training included</li>
                    <li>• SLA guarantees</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative z-10 py-16 px-6 bg-gradient-to-r from-secondary/10 via-accent/5 to-primary/10">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Card className="bg-gradient-to-br from-white/10 via-secondary/10 to-accent/10 border-white/20 rounded-3xl backdrop-blur-sm shadow-2xl">
              <CardHeader>
                <CardTitle className="text-secondary font-bold text-2xl text-center">Contact Support</CardTitle>
                <CardDescription className="text-white/90 font-medium text-center">
                  Get in touch with our team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <Input
                    placeholder="Your Name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-2xl h-12 font-medium backdrop-blur-sm"
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Your Email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-2xl h-12 font-medium backdrop-blur-sm"
                    required
                  />
                  <Textarea
                    placeholder="Your Message"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-2xl font-medium backdrop-blur-sm"
                    rows={4}
                    required
                  />
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-secondary to-accent hover:shadow-xl rounded-2xl h-12 font-bold transition-all duration-300"
                  >
                    Contact Support
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 bg-slate-900 border-t border-slate-700">
        <div className="container mx-auto text-center">
          <p className="text-slate-400">
            © Needs Technology Pty LTD – 2025 | Richmond AU
          </p>
        </div>
      </footer>
    </div>
  );
}