import { useState } from "react";
import { Wallet, Globe, BarChart3, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { getRememberMePreference } from "@/lib/supabase";

const features = [
  {
    icon: Globe,
    title: "Multi-Currency",
    description: "Track budgets in any currency with clear totals and reports.",
  },
  {
    icon: BarChart3,
    title: "Visual Reports",
    description: "See where your money goes with charts and category breakdowns.",
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
  const {
    signInWithPassword,
    signUpWithPassword,
    sendMagicLink,
    isSigningIn,
    isSigningUp,
    isSendingMagicLink,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(getRememberMePreference());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setNotice(null);
    try {
      await signInWithPassword({ email, password, rememberMe });
    } catch (err: any) {
      setError(err?.message || "Unable to sign in");
    }
  }

  async function handleSignUp() {
    setError(null);
    setNotice(null);
    try {
      await signUpWithPassword({ email, password });
      setNotice("Account created. If email confirmation is enabled, check your inbox.");
    } catch (err: any) {
      setError(err?.message || "Unable to create account");
    }
  }

  async function handleMagicLink() {
    setError(null);
    setNotice(null);
    try {
      await sendMagicLink({ email });
      setNotice("Magic link sent. Open your email and tap the sign-in link.");
    } catch (err: any) {
      setError(err?.message || "Unable to send magic link");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 lg:py-0 animate-in fade-in duration-700">
        <div className="max-w-md w-full space-y-8">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">Fudget</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="text-hero-title">
              Your money, simplified.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Create your own account and keep your budgets private, clean, and easy to manage.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-auth-email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-auth-password"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                data-testid="checkbox-remember-me"
              />
              <span>Remember me</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                size="lg"
                onClick={handleSignIn}
                disabled={!email || !password || isSigningIn}
                data-testid="button-signin-password"
              >
                {isSigningIn ? "Signing in..." : "Sign In"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleSignUp}
                disabled={!email || !password || isSigningUp}
                data-testid="button-signup-password"
              >
                {isSigningUp ? "Creating..." : "Create Account"}
              </Button>
            </div>
            <Button
              size="lg"
              variant="ghost"
              onClick={handleMagicLink}
              disabled={!email || isSendingMagicLink}
              className="w-full"
              data-testid="button-send-magic-link"
            >
              {isSendingMagicLink ? "Sending..." : "Email Me a Magic Link"}
            </Button>
            {notice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-muted/40 flex items-center justify-center px-6 py-12 lg:py-0 animate-in fade-in duration-1000 delay-200">
        <div className="max-w-sm w-full space-y-6">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-primary/10 p-2 shrink-0">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
