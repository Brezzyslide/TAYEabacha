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
      className="absolute hidden lg:block text-sm text-slate-400 bg-slate-800/20 px-4 py-2 rounded-full backdrop-blur-sm border border-slate-700/30 pointer-events-none z-0"
    >
      {text}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
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
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src={needCareAILogo} 
                alt="NeedCareAI+ Logo" 
                className="h-12 w-auto"
              />
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
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? "bg-cyan-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-700"
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
                className="hidden md:flex border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white"
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
          <div className="md:hidden bg-slate-800 border-t border-slate-700">
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
                  className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? "bg-cyan-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <a href="/auth" className="block">
                <Button
                  variant="outline"
                  className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white"
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
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              NeedCareAI+
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Comprehensive Care Management Platform
            </p>
          </motion.div>

          {/* Strategic Message Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-slate-800/60 backdrop-blur-sm border border-slate-600 rounded-2xl p-8 mb-12"
          >
            <blockquote className="text-lg leading-relaxed text-slate-200 italic">
              "NeedCareAI+ was built by disability support workers, not tech bros.
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
              <Card className="bg-slate-800/60 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Built for Practitioners</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300">
                    Created by support workers who understand the daily challenges of disability care.
                    Every feature is designed with real-world practice in mind.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-cyan-400">NDIS Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300">
                    Built-in compliance features ensure your documentation meets NDIS standards
                    and supports funding applications with evidence-backed care design.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Positive Behaviour Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300">
                    PBS principles are integrated throughout the platform, not just in care plans.
                    Every interaction is designed to support participant regulation and dignity.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Comprehensive Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300">
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
              <Card className="bg-slate-800/60 border-slate-600 max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Book a Demo</CardTitle>
                  <CardDescription className="text-slate-300">
                    See NeedCareAI+ in action with a personalized demonstration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 mb-6">
                    Our team will walk you through the platform's features and show you how
                    it can transform your care management processes.
                  </p>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
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
              <Card className="bg-slate-800/60 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-cyan-400 text-center">Our Philosophy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-slate-300">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">Person-Centered Design</h3>
                    <p>Every feature is built with the participant at the center. Technology should enhance human connection, not replace it.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">Practitioner-Led Development</h3>
                    <p>Built by support workers who understand the reality of care delivery. No ivory tower solutions here.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">Evidence-Based Practice</h3>
                    <p>Every interaction supports evidence collection for better outcomes and NDIS compliance.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">Dignity in Technology</h3>
                    <p>Technology that respects the dignity of both participants and support workers in every interaction.</p>
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
              <Card className="bg-slate-800/60 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Starter</CardTitle>
                  <CardDescription className="text-slate-300">Perfect for small teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white mb-4">$29/month</div>
                  <ul className="text-slate-300 space-y-2">
                    <li>• Up to 10 participants</li>
                    <li>• Basic shift management</li>
                    <li>• Care plan templates</li>
                    <li>• Email support</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-600 border-cyan-500">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Professional</CardTitle>
                  <CardDescription className="text-slate-300">Most popular choice</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white mb-4">$79/month</div>
                  <ul className="text-slate-300 space-y-2">
                    <li>• Unlimited participants</li>
                    <li>• Advanced analytics</li>
                    <li>• AI-powered insights</li>
                    <li>• Priority support</li>
                    <li>• NDIS compliance tools</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Enterprise</CardTitle>
                  <CardDescription className="text-slate-300">For large organizations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white mb-4">Custom</div>
                  <ul className="text-slate-300 space-y-2">
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
      <section className="relative z-10 py-16 px-6 bg-slate-800/30">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Card className="bg-slate-800/60 border-slate-600">
              <CardHeader>
                <CardTitle className="text-cyan-400 text-center">Contact Support</CardTitle>
                <CardDescription className="text-slate-300 text-center">
                  Get in touch with our team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <Input
                    placeholder="Your Name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Your Email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    required
                  />
                  <Textarea
                    placeholder="Your Message"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    rows={4}
                    required
                  />
                  <Button
                    type="submit"
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
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