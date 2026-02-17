"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { User, Mail, Zap, Bell, Shield, Key, Link as LinkIcon, Lock, Save } from "lucide-react";
import { syncOnboardingState } from "@/lib/onboarding";
import { validatePasswordStrength } from "@/lib/validation/password";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { apiFetch } from "@/lib/api-client";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isRestartingTour, setIsRestartingTour] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordUpdateError, setPasswordUpdateError] = useState("");
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const passwordStrength = useMemo(
    () => validatePasswordStrength(newPassword),
    [newPassword],
  );

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const handleRestartTour = async () => {
    setIsRestartingTour(true);
    await syncOnboardingState({
      tourPending: true,
      tourCompleted: false,
      tourDismissed: false,
    });
    setIsRestartingTour(false);
    window.location.href = "/dashboard";
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordUpdateError("");
    setPasswordUpdateSuccess("");

    if (!currentPassword) {
      setPasswordUpdateError("Current password is required.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordUpdateError("New password and confirmation do not match.");
      return;
    }

    if (!passwordStrength.isValid) {
      setPasswordUpdateError("Password does not meet strength requirements.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const response = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const errorMessage =
          payload?.error || payload?.data?.error || "Failed to update password.";
        setPasswordUpdateError(errorMessage);
        return;
      }

      setPasswordUpdateSuccess(
        payload?.message || payload?.data?.message || "Password updated successfully.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      console.error("Change password error:", error);
      setPasswordUpdateError("Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-fraunces font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-7">
            <TabsTrigger value="profile"><User className="mr-2 h-4 w-4 hidden sm:inline" />Profile</TabsTrigger>
            <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4 hidden sm:inline" />Email</TabsTrigger>
            <TabsTrigger value="sequences"><Zap className="mr-2 h-4 w-4 hidden sm:inline" />Sequences</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4 hidden sm:inline" />Notifications</TabsTrigger>
            <TabsTrigger value="privacy"><Shield className="mr-2 h-4 w-4 hidden sm:inline" />Privacy</TabsTrigger>
            <TabsTrigger value="api"><Key className="mr-2 h-4 w-4 hidden sm:inline" />API</TabsTrigger>
            <TabsTrigger value="integrations"><LinkIcon className="mr-2 h-4 w-4 hidden sm:inline" />Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label htmlFor="firstName">First Name</Label><Input id="firstName" defaultValue="John" className="mt-2" /></div>
                  <div><Label htmlFor="lastName">Last Name</Label><Input id="lastName" defaultValue="Doe" className="mt-2" /></div>
                </div>
                <div><Label htmlFor="email">Email</Label><Input id="email" type="email" defaultValue="john.doe@example.com" className="mt-2" /></div>
                <div><Label htmlFor="role">Role/Title</Label><Input id="role" defaultValue="Software Engineer" className="mt-2" /></div>
                <div><Label htmlFor="company">Company/School</Label><Input id="company" defaultValue="Stanford University" className="mt-2" /></div>
                <div><Label htmlFor="bio">Bio</Label><Textarea id="bio" placeholder="Tell us about yourself..." className="mt-2 min-h-[100px]" /></div>
                <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Saving..." : "Save Changes"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <Card>
              <CardHeader><CardTitle>Email Preferences</CardTitle><CardDescription>Configure email settings</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div><Label>Default Email Client</Label><Select defaultValue="gmail"><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gmail">Gmail</SelectItem><SelectItem value="outlook">Outlook</SelectItem></SelectContent></Select></div>
                <div><Label htmlFor="signature">Email Signature</Label><Textarea id="signature" placeholder="Best regards,&#10;John Doe" className="mt-2 min-h-[100px] font-mono text-sm" /></div>
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Enable Email Tracking</Label><p className="text-sm text-muted-foreground">Track when emails are opened</p></div><Switch defaultChecked /></div>
                <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Saving..." : "Save Changes"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sequences">
            <Card>
              <CardHeader><CardTitle>Sequence Defaults</CardTitle><CardDescription>Set default values</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div><Label>Default Delay Between Steps (days)</Label><Input type="number" defaultValue="3" min="1" className="mt-2" /></div>
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Auto-stop on Reply</Label><p className="text-sm text-muted-foreground">Pause sequence when contact replies</p></div><Switch defaultChecked /></div>
                <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Saving..." : "Save Changes"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>New Replies</Label><p className="text-sm text-muted-foreground">Get notified when someone replies</p></div><Switch defaultChecked /></div>
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Sequence Completed</Label><p className="text-sm text-muted-foreground">Notify when sequence finishes</p></div><Switch defaultChecked /></div>
                <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Saving..." : "Save Changes"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card>
              <CardHeader><CardTitle>Data & Privacy</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div><h3 className="font-medium mb-2">Export Data</h3><p className="text-sm text-muted-foreground mb-3">Download all your data</p><Button variant="outline">Export All Data</Button></div>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Change Password
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use a strong password to keep your account secure.
                  </p>

                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        className="mt-2"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        className="mt-2"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                      />
                    </div>

                    <PasswordStrengthIndicator result={passwordStrength} />

                    <div>
                      <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                      <Input
                        id="confirmNewPassword"
                        type="password"
                        className="mt-2"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        required
                      />
                    </div>

                    {passwordUpdateError && (
                      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {passwordUpdateError}
                      </p>
                    )}

                    {passwordUpdateSuccess && (
                      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {passwordUpdateSuccess}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={isUpdatingPassword || !passwordStrength.isValid}
                    >
                      {isUpdatingPassword ? "Updating Password..." : "Update Password"}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader><CardTitle>API Keys</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Anthropic API Key (Optional)</Label><Input type="password" placeholder="sk-ant-..." className="mt-2" /><p className="text-xs text-muted-foreground mt-1">For AI-powered email drafts</p></div>
                <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Saving..." : "Save Changes"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><LinkIcon className="h-5 w-5 text-primary" /></div><div><p className="font-medium">Chrome Extension</p><p className="text-sm text-muted-foreground">Add contacts from LinkedIn</p></div></div>
                  <Button variant="outline">Install</Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Onboarding Tour</p>
                    <p className="text-sm text-muted-foreground">Replay the guided dashboard tour</p>
                  </div>
                  <Button variant="outline" onClick={handleRestartTour} disabled={isRestartingTour}>
                    {isRestartingTour ? "Restarting..." : "Restart Tour"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
