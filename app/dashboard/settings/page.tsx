"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Mail, Zap, Bell, Shield, Key, Link as LinkIcon, Save } from "lucide-react";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
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
              <CardContent className="space-y-4">
                <div><h3 className="font-medium mb-2">Export Data</h3><p className="text-sm text-muted-foreground mb-3">Download all your data</p><Button variant="outline">Export All Data</Button></div>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
