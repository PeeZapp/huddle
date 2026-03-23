import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "@/lib/firebase";

type Panel = "signin" | "signup" | "reset";

interface Props {
  onAuth: (displayName: string | null) => void;
}

export default function Auth({ onAuth }: Props) {
  const [panel, setPanel]         = useState<Panel>("signin");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [name, setName]           = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [resetSent, setResetSent] = useState(false);

  const clearError = () => setError("");

  function friendlyError(code: string) {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Incorrect email or password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/popup-closed-by-user":
        return "Sign-in popup was closed. Please try again.";
      case "auth/network-request-failed":
        return "Network error — check your connection and try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  const handleGoogle = async () => {
    setLoading(true);
    clearError();
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onAuth(result.user.displayName);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    clearError();
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      onAuth(cred.user.displayName);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name.trim()) return;
    setLoading(true);
    clearError();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      onAuth(name.trim());
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError("Enter your email address above first."); return; }
    setLoading(true);
    clearError();
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative overflow-hidden flex flex-col bg-background">
      {/* Background blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] bg-primary/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] bg-accent/15 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18 }}
          className="w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-primary/25 mb-6"
        >
          <Sparkles size={36} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-display font-bold mb-1">
            {panel === "signin" ? "Welcome back" : panel === "signup" ? "Create account" : "Reset password"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {panel === "signin"
              ? "Sign in to your Huddle account"
              : panel === "signup"
              ? "Join Huddle and start planning meals"
              : "We'll send a reset link to your email"}
          </p>
        </motion.div>

        <div className="w-full max-w-sm space-y-3">

          {/* Google button — sign in / sign up panels only */}
          {panel !== "reset" && (
            <Button
              variant="outline"
              className="w-full h-12 gap-3 text-sm font-medium border-border"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
          )}

          {/* Divider */}
          {panel !== "reset" && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Form fields */}
          <AnimatePresence mode="wait">
            <motion.div
              key={panel}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {panel === "signup" && (
                <Input
                  placeholder="Your name"
                  icon={<User size={16} />}
                  value={name}
                  onChange={e => { setName(e.target.value); clearError(); }}
                  autoComplete="name"
                  className="h-12"
                />
              )}

              <Input
                type="email"
                placeholder="Email address"
                icon={<Mail size={16} />}
                value={email}
                onChange={e => { setEmail(e.target.value); clearError(); }}
                autoComplete={panel === "signup" ? "email" : "username"}
                className="h-12"
              />

              {panel !== "reset" && (
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Password"
                    icon={<Lock size={16} />}
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError(); }}
                    onKeyDown={e => e.key === "Enter" && (panel === "signin" ? handleSignIn() : handleSignUp())}
                    autoComplete={panel === "signup" ? "new-password" : "current-password"}
                    className="h-12 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive text-center px-1"
                >
                  {error}
                </motion.p>
              )}

              {/* Reset sent */}
              {resetSent && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-primary text-center"
                >
                  Reset email sent — check your inbox.
                </motion.p>
              )}

              {/* Primary action */}
              {panel === "signin" && (
                <Button
                  className="w-full h-12"
                  onClick={handleSignIn}
                  disabled={loading || !email || !password}
                >
                  {loading ? "Signing in…" : "Sign in"}
                  {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              )}

              {panel === "signup" && (
                <Button
                  className="w-full h-12"
                  onClick={handleSignUp}
                  disabled={loading || !email || !password || !name.trim()}
                >
                  {loading ? "Creating account…" : "Create account"}
                  {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              )}

              {panel === "reset" && !resetSent && (
                <Button
                  className="w-full h-12"
                  onClick={handleReset}
                  disabled={loading || !email}
                >
                  {loading ? "Sending…" : "Send reset link"}
                  {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Secondary links */}
          <div className="pt-2 space-y-2 text-center">
            {panel === "signin" && (
              <>
                <button
                  onClick={() => { setPanel("reset"); clearError(); }}
                  className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    onClick={() => { setPanel("signup"); clearError(); }}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </>
            )}

            {panel === "signup" && (
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => { setPanel("signin"); clearError(); }}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}

            {panel === "reset" && (
              <button
                onClick={() => { setPanel("signin"); clearError(); setResetSent(false); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
