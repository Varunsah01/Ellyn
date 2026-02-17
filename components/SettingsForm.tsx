"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/Button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  Save,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAuthUrl } from "@/lib/gmail-helper";
import { useToast } from "@/hooks/useToast";
import { useSearchParams } from "next/navigation";
import { CsrfHiddenInput } from "@/components/CsrfHiddenInput";

const formSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
});

/**
 * Render the SettingsForm component.
 * @returns {unknown} JSX output for SettingsForm.
 * @example
 * <SettingsForm />
 */
export function SettingsForm() {
  const [currentStep, setCurrentStep] = useState<
    "credentials" | "connect" | "connected"
  >("credentials");
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: "",
      clientSecret: "",
    },
  });

  // Check OAuth callback status
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      setCurrentStep("connected");
      setIsConnected(true);
      toast({
        title: "Gmail Connected!",
        description: "You can now send emails from the Leads tab.",
      });
    } else if (status === "cancelled") {
      toast({
        title: "Connection Cancelled",
        description: "You cancelled the Gmail authorization.",
        variant: "destructive",
      });
    } else if (status === "error") {
      toast({
        title: "Connection Error",
        description: "Failed to connect Gmail. Please try again.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  // Load credentials and check connection status on mount
  useEffect(() => {
    async function loadCredentials() {
      const { data, error } = await supabase
        .from("gmail_credentials")
        .select("*")
        .single();

      if (data && !error) {
        form.setValue("clientId", data.client_id);
        form.setValue("clientSecret", data.client_secret);

        if (data.access_token && data.refresh_token) {
          setCurrentStep("connected");
          setIsConnected(true);
        } else {
          setCurrentStep("connect");
        }
      }
    }
    loadCredentials();
  }, [form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      // Save credentials to Supabase
      const { error } = await supabase.from("gmail_credentials").upsert(
        {
          client_id: values.clientId,
          client_secret: values.clientSecret,
        },
        { onConflict: "client_id" }
      );

      if (error) throw error;

      toast({
        title: "Credentials Saved",
        description: "Now connect your Gmail account to start sending emails.",
      });
      setCurrentStep("connect");
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleConnectGmail() {
    const clientId = form.getValues("clientId");
    if (!clientId) {
      toast({
        title: "Missing Client ID",
        description: "Please save your credentials first.",
        variant: "destructive",
      });
      return;
    }

    const redirectUri = `${window.location.origin}/api/v1/gmail/oauth`;
    const authUrl = getAuthUrl(clientId, redirectUri);
    window.location.href = authUrl;
  }

  async function handleDisconnect() {
    try {
      const { error } = await supabase
        .from("gmail_credentials")
        .update({ access_token: null, refresh_token: null })
        .eq("client_id", form.getValues("clientId"));

      if (error) throw error;

      setCurrentStep("connect");
      setIsConnected(false);
      toast({
        title: "Gmail Disconnected",
        description: "You can reconnect anytime.",
      });
    } catch (error: any) {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Gmail",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === "credentials"
                ? "bg-primary text-primary-foreground"
                : "bg-green-500 text-white"
            }`}
          >
            {currentStep === "credentials" ? "1" : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <span className="text-sm font-medium">Credentials</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === "connect"
                ? "bg-primary text-primary-foreground"
                : currentStep === "connected"
                ? "bg-green-500 text-white"
                : "bg-gray-300 text-gray-600"
            }`}
          >
            {currentStep === "connected" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              "2"
            )}
          </div>
          <span className="text-sm font-medium">Connect Gmail</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === "connected"
                ? "bg-green-500 text-white"
                : "bg-gray-300 text-gray-600"
            }`}
          >
            {currentStep === "connected" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              "3"
            )}
          </div>
          <span className="text-sm font-medium">Ready!</span>
        </div>
      </div>

      {/* Step 1: Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Gmail API Credentials</CardTitle>
          <CardDescription>
            Configure your own Gmail API credentials to send emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold mb-2 flex items-center">
              How to get your credentials
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Go to{" "}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  Google Cloud Console
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Gmail API for your project</li>
              <li>Go to Credentials → Create OAuth 2.0 Client ID</li>
              <li>Choose &quot;Web application&quot; as the application type</li>
              <li>
                Add this as authorized redirect URI:{" "}
                <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/api/v1/gmail/oauth`
                    : "https://yourapp.com/api/v1/gmail/oauth"}
                </code>
              </li>
              <li>Copy your Client ID and Client Secret below</li>
            </ol>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <CsrfHiddenInput />
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123456789-abcdefghijklmnop.apps.googleusercontent.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Your OAuth 2.0 Client ID from Google Cloud Console
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Secret</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="GOCSPX-abcdefghijklmnopqrstuvwxyz"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Your OAuth 2.0 Client Secret from Google Cloud Console
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Credentials"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Step 2: Connect Gmail */}
      {currentStep !== "credentials" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Connect Your Gmail Account</CardTitle>
            <CardDescription>
              Authorize the app to send emails on your behalf
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-900 dark:text-green-100">
                      Gmail Connected!
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      You can now send emails from the Leads tab
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  className="w-full"
                >
                  Disconnect Gmail
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                      Gmail Not Connected
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Click below to authorize sending emails
                    </p>
                  </div>
                </div>
                <Button onClick={handleConnectGmail} className="w-full">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Connect Gmail Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

