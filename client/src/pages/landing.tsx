import { Wallet, Globe, BarChart3, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Globe,
    title: "Multi-Currency",
    description: "Track budgets in any currency with real-time conversion.",
  },
  {
    icon: BarChart3,
    title: "Visual Reports",
    description: "See where your money goes with clear charts and breakdowns.",
  },
  {
    icon: Landmark,
    title: "Net Worth",
    description: "Monitor your total financial picture across all accounts.",
  },
  {
    icon: Smartphone,
    title: "Works Everywhere",
    description: "Install as a PWA on any device for instant access.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 lg:py-0 animate-in fade-in duration-700">
        <div className="max-w-md w-full space-y-8">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">Fudget</span>
          </div>

          <div className="space-y-3">
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              data-testid="text-hero-title"
            >
              Your money, simplified.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              A minimalist budget tracker that helps you stay on top of your
              finances without the clutter.
            </p>
          </div>

          <div className="pt-2">
            <a href="/api/login">
              <Button size="lg" className="w-full sm:w-auto" data-testid="button-login">
                Get Started
              </Button>
            </a>
            <p className="text-xs text-muted-foreground mt-3">
              Free forever. No credit card required.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-muted/40 flex items-center justify-center px-6 py-12 lg:py-0 animate-in fade-in duration-1000 delay-200">
        <div className="max-w-sm w-full space-y-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3"
            >
              <div className="mt-0.5 rounded-md bg-primary/10 p-2 shrink-0">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
