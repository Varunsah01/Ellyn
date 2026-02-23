"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/useToast";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { validatePasswordStrength } from "@/lib/validation/password";
import {
  AlertTriangle,
  RefreshCw,
  Link as LinkIcon,
  Lock,
  Mail,
  Plug,
  Save,
  Shield,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type EmailProvider = "gmail" | "outlook" | "smtp";
type SmtpEncryption = "tls" | "ssl" | "none";

interface EmailPreferences {
  fromName: string;
  provider: EmailProvider;
  smtp: {
    host: string;
    port: number;
    username: string;
    password: string;
    encryption: SmtpEncryption;
  };
  signature: string;
  defaultSendTime: string;
  timezone: string;
  includeUnsubscribeFooter: boolean;
}

interface SequencePreferences {
  followUpIntervalDays: number;
  maxFollowUpsPerContact: number;
  autoPauseOnReply: boolean;
  autoPauseOnOoo: boolean;
  dailySendLimit: number;
  sendingWindowStart: string;
  sendingWindowEnd: string;
  sendingDays: string[];
  blackoutDates: string[];
}

interface PrivacyPreferences {
  retention: "6_months" | "1_year" | "2_years" | "forever";
  allowAnonymizedAi: boolean;
}

interface IntegrationPreferences {
  gmail_connected: boolean;
  outlook_connected: boolean;
  extension_linked: boolean;
}

interface ExtensionSyncState {
  connected: boolean;
  extensionContactsCount: number;
  lastSyncAt: string | null;
  error: string | null;
  loading: boolean;
}

const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  fromName: "",
  provider: "gmail",
  smtp: { host: "", port: 587, username: "", password: "", encryption: "tls" },
  signature: "",
  defaultSendTime: "09:00",
  timezone: "America/New_York",
  includeUnsubscribeFooter: true,
};

const DEFAULT_SEQUENCE_PREFERENCES: SequencePreferences = {
  followUpIntervalDays: 3,
  maxFollowUpsPerContact: 3,
  autoPauseOnReply: true,
  autoPauseOnOoo: true,
  dailySendLimit: 50,
  sendingWindowStart: "09:00",
  sendingWindowEnd: "17:00",
  sendingDays: ["mon", "tue", "wed", "thu", "fri"],
  blackoutDates: [],
};

const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  retention: "1_year",
  allowAnonymizedAi: true,
};

const DEFAULT_INTEGRATIONS: IntegrationPreferences = {
  gmail_connected: false,
  outlook_connected: false,
  extension_linked: false,
};

const DEFAULT_EXTENSION_SYNC_STATE: ExtensionSyncState = {
  connected: false,
  extensionContactsCount: 0,
  lastSyncAt: null,
  error: null,
  loading: true,
};
const EXTENSION_CONNECTED_WINDOW_MS = 10 * 60 * 1000;

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
];

const DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

type SettingsSectionId =
  | "profile"
  | "email"
  | "privacy"
  | "integrations";

type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "email", label: "Email", icon: Mail },
  { id: "privacy", label: "Privacy & Security", icon: Shield },
  { id: "integrations", label: "Integrations", icon: LinkIcon },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNum(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitFullName(fullName: string): [string, string] {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  return [first, rest.join(" ")];
}

function initials(value: string): string {
  const token = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((v) => v[0]?.toUpperCase() || "")
    .join("");
  return token || "?";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toSignatureEditorHtml(value: string): string {
  const input = value.trim();
  if (!input) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(input);
  if (looksLikeHtml) return value;
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function normalizeSignatureHtml(value: string): string {
  const collapsed = value
    .replace(/&nbsp;/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
  return collapsed ? value : "";
}

function formatRelativeTimestamp(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Never";

  const deltaMs = Math.max(0, Date.now() - parsed.getTime());
  const deltaMinutes = Math.floor(deltaMs / 60000);

  if (deltaMinutes <= 0) return "just now";
  if (deltaMinutes === 1) return "1 min ago";
  if (deltaMinutes < 60) return `${deltaMinutes} min ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours === 1) return "1 hour ago";
  if (deltaHours < 24) return `${deltaHours} hours ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays === 1) return "1 day ago";
  return `${deltaDays} days ago`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const metadataRef = useRef<Record<string, unknown>>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>(DEFAULT_EMAIL_PREFERENCES);
  const [sequencePrefs, setSequencePrefs] = useState<SequencePreferences>(DEFAULT_SEQUENCE_PREFERENCES);
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPreferences>(DEFAULT_PRIVACY_PREFERENCES);
  const [integrations, setIntegrations] = useState<IntegrationPreferences>(DEFAULT_INTEGRATIONS);
  const [extensionSync, setExtensionSync] = useState<ExtensionSyncState>(DEFAULT_EXTENSION_SYNC_STATE);
  const [reauthLoading, setReauthLoading] = useState(false);

  const [blackoutInput, setBlackoutInput] = useState("");
  const [saveProfileLoading, setSaveProfileLoading] = useState(false);
  const [saveEmailLoading, setSaveEmailLoading] = useState(false);
  const [saveSequenceLoading, setSaveSequenceLoading] = useState(false);
  const [savePrivacyLoading, setSavePrivacyLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordUpdateError, setPasswordUpdateError] = useState("");
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState("");
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("profile");

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const sectionCardRef = useRef<HTMLDivElement | null>(null);
  const signatureEditorRef = useRef<HTMLDivElement | null>(null);
  const sectionInitRef = useRef(false);
  const nameForAvatar = useMemo(
    () => `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Account",
    [firstName, lastName, email],
  );
  const passwordStrength = useMemo(() => validatePasswordStrength(newPassword), [newPassword]);

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);
  const saveMetadataPatch = useCallback(
    async (patch: Record<string, unknown>, successMessage: string) => {
      if (!isSupabaseConfigured) {
        toast({
          variant: "destructive",
          title: "Supabase not configured",
          description: "Cannot save settings.",
        });
        return false;
      }

      const merged = { ...metadataRef.current, ...patch };
      const { error } = await supabase.auth.updateUser({ data: merged });
      if (error) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: error.message || "Unable to save settings.",
        });
        return false;
      }

      setMetadata(merged);
      metadataRef.current = merged;
      toast({ title: "Saved", description: successMessage });
      return true;
    },
    [toast],
  );

  const loadExtensionSyncStatus = useCallback(async (targetUserId: string) => {
    if (!targetUserId || !isSupabaseConfigured) {
      setExtensionSync({
        connected: false,
        extensionContactsCount: 0,
        lastSyncAt: null,
        error: null,
        loading: false,
      });
      return;
    }

    setExtensionSync((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const [profileRes, extensionContactsRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("extension_last_seen")
          .eq("id", targetUserId)
          .maybeSingle(),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("source", "extension"),
      ]);

      if (profileRes.error) {
        throw profileRes.error;
      }
      if (extensionContactsRes.error) {
        throw extensionContactsRes.error;
      }

      const lastSyncAt = profileRes.data?.extension_last_seen ?? null;
      const lastSyncDate = lastSyncAt ? new Date(lastSyncAt) : null;
      const connected =
        !!lastSyncDate &&
        Number.isFinite(lastSyncDate.getTime()) &&
        Date.now() - lastSyncDate.getTime() <= EXTENSION_CONNECTED_WINDOW_MS;

      setExtensionSync({
        connected,
        extensionContactsCount: typeof extensionContactsRes.count === "number" ? extensionContactsRes.count : 0,
        lastSyncAt,
        error: null,
        loading: false,
      });
    } catch (error) {
      setExtensionSync({
        connected: false,
        extensionContactsCount: 0,
        lastSyncAt: null,
        error: error instanceof Error ? error.message : "Unable to load extension sync status",
        loading: false,
      });
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) throw new Error("No authenticated user");

      const meta = asRecord(user.user_metadata);
      const [splitFirst, splitLast] = splitFullName(asString(meta.full_name));
      setEmail(asString(user.email));
      setUserId(user.id);
      setFirstName(asString(meta.first_name, splitFirst));
      setLastName(asString(meta.last_name, splitLast));
      setRole(asString(meta.role));
      setCompany(asString(meta.company));
      setBio(asString(meta.bio));
      setAvatarUrl(asString(meta.avatar_url));

      const emailMeta = asRecord(meta.email_preferences);
      const smtpMeta = asRecord(emailMeta.smtp);
      const provider = asString(emailMeta.provider, "gmail");
      const encryption = asString(smtpMeta.encryption, "tls");
      setEmailPrefs({
        fromName: asString(emailMeta.fromName),
        provider: provider === "outlook" || provider === "smtp" ? (provider as EmailProvider) : "gmail",
        smtp: {
          host: asString(smtpMeta.host),
          port: asNum(smtpMeta.port, 587),
          username: asString(smtpMeta.username),
          password: asString(smtpMeta.password),
          encryption: encryption === "ssl" || encryption === "none" ? (encryption as SmtpEncryption) : "tls",
        },
        signature: toSignatureEditorHtml(asString(emailMeta.signature)),
        defaultSendTime: asString(emailMeta.defaultSendTime, "09:00"),
        timezone: asString(emailMeta.timezone, "America/New_York"),
        includeUnsubscribeFooter: asBool(emailMeta.includeUnsubscribeFooter, true),
      });

      const seq = asRecord(meta.sequence_preferences);
      const sendDays = Array.isArray(seq.sendingDays)
        ? seq.sendingDays.filter((d): d is string => typeof d === "string")
        : DEFAULT_SEQUENCE_PREFERENCES.sendingDays;
      const blackouts = Array.isArray(seq.blackoutDates)
        ? seq.blackoutDates.filter((d): d is string => typeof d === "string")
        : [];
      setSequencePrefs({
        followUpIntervalDays: asNum(seq.followUpIntervalDays, 3),
        maxFollowUpsPerContact: asNum(seq.maxFollowUpsPerContact, 3),
        autoPauseOnReply: asBool(seq.autoPauseOnReply, true),
        autoPauseOnOoo: asBool(seq.autoPauseOnOoo, true),
        dailySendLimit: Math.min(200, Math.max(1, asNum(seq.dailySendLimit, 50))),
        sendingWindowStart: asString(seq.sendingWindowStart, "09:00"),
        sendingWindowEnd: asString(seq.sendingWindowEnd, "17:00"),
        sendingDays: sendDays.length ? sendDays : DEFAULT_SEQUENCE_PREFERENCES.sendingDays,
        blackoutDates: blackouts,
      });

      const privacy = asRecord(meta.privacy_preferences);
      const retention = asString(privacy.retention, "1_year");
      setPrivacyPrefs({
        retention:
          retention === "6_months" || retention === "2_years" || retention === "forever"
            ? (retention as PrivacyPreferences["retention"])
            : "1_year",
        allowAnonymizedAi: asBool(privacy.allowAnonymizedAi, true),
      });

      setIntegrations({
        gmail_connected: asBool(meta.gmail_connected),
        outlook_connected: asBool(meta.outlook_connected),
        extension_linked: asBool(meta.extension_linked),
      });
      await loadExtensionSyncStatus(user.id);
      setMetadata(meta);
      metadataRef.current = meta;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to load settings",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [loadExtensionSyncStatus, toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!sectionInitRef.current) {
      sectionInitRef.current = true;
      return;
    }
    sectionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSection]);

  useEffect(() => {
    const editor = signatureEditorRef.current;
    if (!editor) return;
    const nextHtml = toSignatureEditorHtml(emailPrefs.signature);
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [emailPrefs.signature]);

  const syncSignatureFromEditor = useCallback(() => {
    const editor = signatureEditorRef.current;
    if (!editor) return;
    const nextValue = normalizeSignatureHtml(editor.innerHTML);
    setEmailPrefs((prev) => (prev.signature === nextValue ? prev : { ...prev, signature: nextValue }));
  }, []);

  const applySignatureFormat = useCallback((command: "bold" | "italic") => {
    const editor = signatureEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false);
    syncSignatureFromEditor();
  }, [syncSignatureFromEditor]);

  const addSignatureLink = useCallback(() => {
    const editor = signatureEditorRef.current;
    if (!editor) return;
    const rawUrl = window.prompt("Enter link URL");
    if (!rawUrl) return;
    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    editor.focus();
    document.execCommand("createLink", false, normalizedUrl);
    syncSignatureFromEditor();
  }, [syncSignatureFromEditor]);

  const saveProfile = async () => {
    setSaveProfileLoading(true);
    const startedAt = Date.now();
    await saveMetadataPatch(
      {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName} ${lastName}`.trim(),
        role: role.trim(),
        company: company.trim(),
        bio: bio.trim(),
      },
      "Profile updated.",
    );
    const elapsed = Date.now() - startedAt;
    if (elapsed < 350) {
      await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
    }
    setSaveProfileLoading(false);
  };

  const onAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isSupabaseConfigured || !userId) return;
    setAvatarLoading(true);
    try {
      const path = `${userId}/avatar`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      setAvatarUrl(url);
      await saveMetadataPatch({ avatar_url: url }, "Avatar updated.");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Avatar upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      setAvatarLoading(false);
    }
  };

  const removeAvatar = async () => {
    if (!isSupabaseConfigured || !userId) return;
    setAvatarLoading(true);
    await supabase.storage.from("avatars").remove([`${userId}/avatar`]);
    setAvatarUrl("");
    await saveMetadataPatch({ avatar_url: null }, "Avatar removed.");
    setAvatarLoading(false);
  };

  const testSmtp = async () => {
    setSmtpTesting(true);
    try {
      const res = await fetch("/api/v1/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPrefs.smtp),
      });
      const payload = (await res.json()) as Record<string, unknown>;
      if (!res.ok || !asBool(payload.ok, false)) {
        throw new Error(asString(payload.error, "SMTP test failed"));
      }
      toast({ title: "SMTP connected", description: "SMTP connection test succeeded." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "SMTP test failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSmtpTesting(false);
    }
  };

  const saveEmail = async () => {
    setSaveEmailLoading(true);
    await saveMetadataPatch({ email_preferences: emailPrefs }, "Email preferences saved.");
    setSaveEmailLoading(false);
  };

  const saveSequences = async () => {
    setSaveSequenceLoading(true);
    await saveMetadataPatch({ sequence_preferences: sequencePrefs }, "Sequence preferences saved.");
    setSaveSequenceLoading(false);
  };

  const savePrivacy = async () => {
    setSavePrivacyLoading(true);
    await saveMetadataPatch({ privacy_preferences: privacyPrefs }, "Privacy preferences saved.");
    setSavePrivacyLoading(false);
  };

  const addBlackout = () => {
    const next = blackoutInput.trim();
    if (!next) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) {
      toast({ variant: "destructive", title: "Invalid date", description: "Use YYYY-MM-DD format." });
      return;
    }
    if (!sequencePrefs.blackoutDates.includes(next)) {
      setSequencePrefs((prev) => ({ ...prev, blackoutDates: [...prev.blackoutDates, next] }));
    }
    setBlackoutInput("");
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
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
    if (!isSupabaseConfigured || !email) {
      setPasswordUpdateError("Unable to update password.");
      return;
    }

    setPasswordUpdating(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        setPasswordUpdateError(reauthError.message || "Current password is incorrect.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setPasswordUpdateError(updateError.message || "Failed to update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordUpdateSuccess("Password updated successfully.");
    } catch (error) {
      setPasswordUpdateError(error instanceof Error ? error.message : "Failed to update password.");
    } finally {
      setPasswordUpdating(false);
    }
  };
  const deleteAccount = async () => {
    if (deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
      toast({
        variant: "destructive",
        title: "Confirmation mismatch",
        description: "Type your account email to confirm deletion.",
      });
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/v1/account/delete", { method: "POST" });
      const payload = (await res.json()) as Record<string, unknown>;
      if (!res.ok || !asBool(payload.ok, false)) {
        throw new Error(asString(payload.error, "Delete failed"));
      }
      if (isSupabaseConfigured) await supabase.auth.signOut();
      router.replace("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const saveIntegrations = useCallback(
    async (next: IntegrationPreferences, message: string) => {
      const ok = await saveMetadataPatch({ ...next }, message);
      if (ok) setIntegrations(next);
    },
    [saveMetadataPatch],
  );

  const handleExtensionReauth = useCallback(async () => {
    if (!isSupabaseConfigured) {
      toast({
        variant: "destructive",
        title: "Supabase not configured",
        description: "Cannot sync extension session.",
      });
      return;
    }

    const extensionIdFromEnv = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID?.trim() || "";
    const extensionIdFromStorage =
      typeof window !== "undefined"
        ? localStorage.getItem("ellyn_extension_id")?.trim() || ""
        : "";
    const extensionId = extensionIdFromEnv || extensionIdFromStorage;

    if (!extensionId) {
      toast({
        variant: "destructive",
        title: "Extension ID missing",
        description: "Set NEXT_PUBLIC_CHROME_EXTENSION_ID or reconnect the extension first.",
      });
      return;
    }

    const runtime = (
      typeof window !== "undefined"
        ? (window as Window & {
            chrome?: { runtime?: { sendMessage?: unknown; lastError?: unknown } };
          }).chrome?.runtime
        : undefined
    );

    if (typeof runtime?.sendMessage !== "function") {
      toast({
        variant: "destructive",
        title: "Chrome runtime unavailable",
        description: "Open this page in Chrome with the extension installed.",
      });
      return;
    }

    setReauthLoading(true);
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session?.access_token || !session?.refresh_token) {
        throw new Error(error?.message || "No active session found");
      }

      await new Promise<void>((resolve, reject) => {
        (runtime.sendMessage as (
          extension: string,
          message: unknown,
          callback: (response: unknown) => void
        ) => void)(
          extensionId,
          {
            type: "ELLYN_SET_SESSION",
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },
          },
          (response) => {
            const lastError = runtime.lastError as { message?: string } | undefined;
            if (lastError) {
              reject(new Error(lastError.message || "Extension did not respond"));
              return;
            }

            const result = response as { ok?: boolean; error?: string } | undefined;
            if (!result?.ok) {
              reject(new Error(result?.error || "Extension rejected session sync"));
              return;
            }
            resolve();
          }
        );
      });

      localStorage.setItem("ellyn_extension_id", extensionId);
      setIntegrations((prev) => ({ ...prev, extension_linked: true }));
      setExtensionSync((prev) => ({
        ...prev,
        connected: true,
        lastSyncAt: new Date().toISOString(),
        error: null,
      }));
      toast({
        title: "Extension session synced",
        description: "Your dashboard session was sent to the Chrome extension.",
      });

      if (userId) {
        window.setTimeout(() => {
          void loadExtensionSyncStatus(userId);
        }, 1200);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Extension re-auth failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setReauthLoading(false);
    }
  }, [loadExtensionSyncStatus, toast, userId]);

  if (loading) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-9 w-full" />
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-36" />
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-fraunces font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="w-full lg:sticky lg:top-24 lg:w-[220px] lg:shrink-0 lg:self-start">
            <div className="lg:hidden">
              <Label htmlFor="settings-section-select">Section</Label>
              <Select
                value={activeSection}
                onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
              >
                <SelectTrigger id="settings-section-select" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTINGS_SECTIONS.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <nav className="hidden rounded-lg border bg-card p-2 lg:flex lg:flex-col">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "border-l-primary bg-primary/10 text-primary"
                        : "border-l-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div ref={sectionCardRef} className="min-w-0 flex-1 scroll-mt-24">
            {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Keep your account identity and personal details up to date.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="accountEmail">Account Email</Label>
                  <Input id="accountEmail" type="email" className="mt-2" value={email} readOnly />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your sign-in email for this workspace.
                  </p>
                </div>
                <div className="rounded-lg border p-4 flex flex-wrap items-center gap-4">
                  <Avatar className="h-16 w-16 border">
                    <AvatarImage src={avatarUrl || undefined} alt={nameForAvatar} />
                    <AvatarFallback>{initials(nameForAvatar)}</AvatarFallback>
                  </Avatar>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFileChange} />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={avatarLoading}>
                      <Upload className="h-4 w-4" />{avatarLoading ? "Uploading..." : "Upload Photo"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={removeAvatar} disabled={!avatarUrl || avatarLoading}>
                      <Trash2 className="h-4 w-4" />Remove Photo
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label htmlFor="firstName">First Name</Label><Input id="firstName" className="mt-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                  <div><Label htmlFor="lastName">Last Name</Label><Input id="lastName" className="mt-2" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
                </div>
                <div><Label htmlFor="role">Role</Label><Input id="role" className="mt-2" value={role} onChange={(e) => setRole(e.target.value)} /></div>
                <div><Label htmlFor="company">Company</Label><Input id="company" className="mt-2" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                <div><Label htmlFor="bio">Bio</Label><Textarea id="bio" className="mt-2 min-h-[100px]" value={bio} onChange={(e) => setBio(e.target.value)} /></div>
                <Button onClick={saveProfile} disabled={saveProfileLoading}><Save className="mr-2 h-4 w-4" />{saveProfileLoading ? "Saving..." : "Save Profile"}</Button>
              </CardContent>
            </Card>
            )}

            {activeSection === "email" && (
            <Card>
              <CardHeader>
                <CardTitle>Email & Outreach</CardTitle>
                <CardDescription>
                  Configure sending identity, inbox provider, and safe day-to-day outreach limits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>From Name</Label><Input className="mt-2" value={emailPrefs.fromName} onChange={(e) => setEmailPrefs((p) => ({ ...p, fromName: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Default Email Provider</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["gmail", "outlook", "smtp"] as EmailProvider[]).map((provider) => (
                      <label key={provider} className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer">
                        <input type="radio" name="provider" value={provider} checked={emailPrefs.provider === provider} onChange={() => setEmailPrefs((p) => ({ ...p, provider }))} />
                        {provider === "smtp" ? "SMTP" : provider === "gmail" ? "Gmail" : "Outlook"}
                      </label>
                    ))}
                  </div>
                </div>
                {emailPrefs.provider === "smtp" && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <h3 className="font-medium">SMTP Settings</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div><Label>SMTP Host</Label><Input className="mt-1" value={emailPrefs.smtp.host} onChange={(e) => setEmailPrefs((p) => ({ ...p, smtp: { ...p.smtp, host: e.target.value } }))} /></div>
                      <div><Label>Port</Label><Input className="mt-1" type="number" value={String(emailPrefs.smtp.port)} onChange={(e) => setEmailPrefs((p) => ({ ...p, smtp: { ...p.smtp, port: Math.max(1, Number(e.target.value) || 1) } }))} /></div>
                      <div><Label>Username</Label><Input className="mt-1" value={emailPrefs.smtp.username} onChange={(e) => setEmailPrefs((p) => ({ ...p, smtp: { ...p.smtp, username: e.target.value } }))} /></div>
                      <div><Label>Password</Label><Input className="mt-1" type="password" value={emailPrefs.smtp.password} onChange={(e) => setEmailPrefs((p) => ({ ...p, smtp: { ...p.smtp, password: e.target.value } }))} /></div>
                    </div>
                    <div>
                      <Label>Encryption</Label>
                      <Select value={emailPrefs.smtp.encryption} onValueChange={(value) => setEmailPrefs((p) => ({ ...p, smtp: { ...p.smtp, encryption: value as SmtpEncryption } }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tls">TLS</SelectItem><SelectItem value="ssl">SSL</SelectItem><SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="outline" onClick={testSmtp} disabled={smtpTesting}>{smtpTesting ? "Testing..." : "Test Connection"}</Button>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Signature</Label>
                  <div className="rounded-md border">
                    <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-2 py-2">
                      <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => applySignatureFormat("bold")}>
                        <span className="font-bold">B</span>
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => applySignatureFormat("italic")}>
                        <span className="italic">I</span>
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={addSignatureLink}>
                        Link
                      </Button>
                    </div>
                    <div
                      ref={signatureEditorRef}
                      className="min-h-[120px] w-full bg-background px-3 py-2 text-sm outline-none"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={syncSignatureFromEditor}
                      data-placeholder="Write your signature..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Signature formatting is saved as HTML and will appear in sent emails.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Default Send Time</Label><Input className="mt-1" type="time" value={emailPrefs.defaultSendTime} onChange={(e) => setEmailPrefs((p) => ({ ...p, defaultSendTime: e.target.value }))} /></div>
                  <div>
                    <Label>Timezone</Label>
                    <Select value={emailPrefs.timezone} onValueChange={(value) => setEmailPrefs((p) => ({ ...p, timezone: value }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIMEZONES.map((zone) => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Max Emails to Send per Day</Label>
                  <Input type="number" max={200} className="mt-2" value={String(sequencePrefs.dailySendLimit)} onChange={(e) => setSequencePrefs((p) => ({ ...p, dailySendLimit: Math.min(200, Math.max(1, Number(e.target.value) || 1)) }))} />
                  {sequencePrefs.dailySendLimit > 100 && <p className="text-sm text-amber-700 mt-1">Warning: daily limits above 100 can impact deliverability.</p>}
                </div>
                <div className="border rounded-lg p-4 flex items-center justify-between">
                  <div><Label>Unsubscribe Footer</Label><p className="text-sm text-muted-foreground">Include one-click unsubscribe footer in outreach emails.</p></div>
                  <Switch checked={emailPrefs.includeUnsubscribeFooter} onCheckedChange={(checked) => setEmailPrefs((p) => ({ ...p, includeUnsubscribeFooter: checked }))} />
                </div>
                <Button onClick={saveEmail} disabled={saveEmailLoading}><Save className="mr-2 h-4 w-4" />{saveEmailLoading ? "Saving..." : "Save Email Preferences"}</Button>
                <Accordion type="single" collapsible className="rounded-lg border px-4">
                  <AccordionItem value="advanced-outreach" className="border-b-0">
                    <AccordionTrigger className="py-3">Advanced Outreach Defaults</AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4">
                      <p className="text-sm text-muted-foreground">
                        Control default timing and limits for outreach sequences.
                      </p>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div><Label>Default Follow-up Interval (days)</Label><Input type="number" className="mt-1" value={String(sequencePrefs.followUpIntervalDays)} onChange={(e) => setSequencePrefs((p) => ({ ...p, followUpIntervalDays: Math.max(1, Number(e.target.value) || 1) }))} /></div>
                        <div><Label>Max Follow-ups per Contact</Label><Input type="number" className="mt-1" value={String(sequencePrefs.maxFollowUpsPerContact)} onChange={(e) => setSequencePrefs((p) => ({ ...p, maxFollowUpsPerContact: Math.max(1, Number(e.target.value) || 1) }))} /></div>
                      </div>
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between"><div><Label>Auto-pause on Reply</Label><p className="text-sm text-muted-foreground">Pause when contact replies.</p></div><Switch checked={sequencePrefs.autoPauseOnReply} onCheckedChange={(checked) => setSequencePrefs((p) => ({ ...p, autoPauseOnReply: checked }))} /></div>
                        <div className="flex items-center justify-between"><div><Label>Auto-pause on OOO Detection</Label><p className="text-sm text-muted-foreground">Pause when out-of-office replies are detected.</p></div><Switch checked={sequencePrefs.autoPauseOnOoo} onCheckedChange={(checked) => setSequencePrefs((p) => ({ ...p, autoPauseOnOoo: checked }))} /></div>
                      </div>
                      <div className="border rounded-lg p-4 space-y-3">
                        <h3 className="font-medium">Sending Window</h3>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div><Label>Start Time</Label><Input type="time" className="mt-1" value={sequencePrefs.sendingWindowStart} onChange={(e) => setSequencePrefs((p) => ({ ...p, sendingWindowStart: e.target.value }))} /></div>
                          <div><Label>End Time</Label><Input type="time" className="mt-1" value={sequencePrefs.sendingWindowEnd} onChange={(e) => setSequencePrefs((p) => ({ ...p, sendingWindowEnd: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                          {DAYS.map((day) => (
                            <label key={day.value} className="border rounded-md px-2 py-2 text-sm flex items-center gap-2">
                              <Checkbox checked={sequencePrefs.sendingDays.includes(day.value)} onCheckedChange={(checked: boolean | "indeterminate") => setSequencePrefs((p) => ({ ...p, sendingDays: checked === true ? Array.from(new Set([...p.sendingDays, day.value])) : p.sendingDays.filter((d) => d !== day.value) }))} />
                              {day.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4 space-y-2">
                        <h3 className="font-medium">Blackout Dates</h3>
                        <div className="flex gap-2">
                          <Input placeholder="YYYY-MM-DD" value={blackoutInput} onChange={(e) => setBlackoutInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBlackout(); } }} />
                          <Button type="button" variant="outline" onClick={addBlackout}>Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sequencePrefs.blackoutDates.length === 0 && <p className="text-sm text-muted-foreground">No blackout dates added.</p>}
                          {sequencePrefs.blackoutDates.map((date) => (
                            <Badge key={date} variant="outline" className="gap-2 pr-1">{date}<button type="button" className="px-1 rounded hover:bg-muted text-xs" onClick={() => setSequencePrefs((p) => ({ ...p, blackoutDates: p.blackoutDates.filter((d) => d !== date) }))}>x</button></Badge>
                          ))}
                        </div>
                      </div>
                      <Button onClick={saveSequences} disabled={saveSequenceLoading}><Save className="mr-2 h-4 w-4" />{saveSequenceLoading ? "Saving..." : "Save Outreach Defaults"}</Button>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
            )}

            {activeSection === "privacy" && (
            <Card>
              <CardHeader><CardTitle>Privacy & Security</CardTitle><CardDescription>Manage security settings, data controls, and account protection.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground mt-1">Add a second verification step to protect your account.</p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/settings/security/2fa">Set up</Link>
                  </Button>
                </div>
                <div><h3 className="font-medium mb-2">Export Data</h3><p className="text-sm text-muted-foreground mb-2">Download all your data from Ellyn.</p><Button variant="outline">Export All Data</Button></div>
                <Accordion type="single" collapsible className="rounded-lg border px-4">
                  <AccordionItem value="privacy-advanced" className="border-b-0">
                    <AccordionTrigger className="py-3">Advanced</AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      <h3 className="font-medium">Data Retention</h3>
                      <Select value={privacyPrefs.retention} onValueChange={(value) => setPrivacyPrefs((p) => ({ ...p, retention: value as PrivacyPreferences["retention"] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6_months">Keep data for 6 months</SelectItem>
                          <SelectItem value="1_year">Keep data for 1 year</SelectItem>
                          <SelectItem value="2_years">Keep data for 2 years</SelectItem>
                          <SelectItem value="forever">Keep data forever</SelectItem>
                        </SelectContent>
                      </Select>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <div className="border rounded-lg p-4 flex items-start justify-between gap-4">
                  <div><Label>Allow Ellyn to use anonymised data to improve AI suggestions</Label><p className="text-sm text-muted-foreground mt-1">Helps improve quality while removing personally identifiable details.</p></div>
                  <Switch checked={privacyPrefs.allowAnonymizedAi} onCheckedChange={(checked) => setPrivacyPrefs((p) => ({ ...p, allowAnonymizedAi: checked }))} />
                </div>
                <Button onClick={savePrivacy} disabled={savePrivacyLoading}><Save className="mr-2 h-4 w-4" />{savePrivacyLoading ? "Saving..." : "Save Privacy Preferences"}</Button>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-2 flex items-center gap-2"><Lock className="h-4 w-4" />Change Password</h3>
                  <form onSubmit={changePassword} className="space-y-4 max-w-xl">
                    <div><Label htmlFor="currentPassword">Current Password</Label><Input id="currentPassword" type="password" className="mt-2" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
                    <div><Label htmlFor="newPassword">New Password</Label><Input id="newPassword" type="password" className="mt-2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
                    <PasswordStrengthIndicator result={passwordStrength} />
                    <div><Label htmlFor="confirmNewPassword">Confirm New Password</Label><Input id="confirmNewPassword" type="password" className="mt-2" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required /></div>
                    {passwordUpdateError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{passwordUpdateError}</p>}
                    {passwordUpdateSuccess && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{passwordUpdateSuccess}</p>}
                    <Button type="submit" disabled={passwordUpdating || !passwordStrength.isValid}>{passwordUpdating ? "Updating Password..." : "Update Password"}</Button>
                  </form>
                </div>

                <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="font-medium text-red-700">Delete Account</h3>
                      <p className="text-sm text-red-700/90">This action is permanent and cannot be undone.</p>
                      <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>Delete Account</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {activeSection === "integrations" && (
              <Card>
                <CardHeader><CardTitle>Integrations</CardTitle><CardDescription>Connect your mailbox and external tools used in your outreach workflow.</CardDescription></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-md bg-red-100 text-red-700 font-semibold flex items-center justify-center">G</div><div><p className="font-medium">Gmail</p><p className="text-sm text-muted-foreground">Connect Gmail for send and reply sync.</p></div></div>{integrations.gmail_connected ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Connected</Badge> : <Badge variant="outline">Not Connected</Badge>}</div>
                    {integrations.gmail_connected ? <Button variant="outline" onClick={() => void saveIntegrations({ ...integrations, gmail_connected: false }, "Gmail disconnected.")}>Disconnect</Button> : <Button asChild><Link href="/api/v1/auth/gmail">Connect Gmail</Link></Button>}
                  </div>
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-md bg-blue-100 text-blue-700 font-semibold flex items-center justify-center">O</div><div><p className="font-medium">Outlook / Microsoft 365</p><p className="text-sm text-muted-foreground">Connect Outlook for send and scheduling.</p></div></div>{integrations.outlook_connected ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Connected</Badge> : <Badge variant="outline">Not Connected</Badge>}</div>
                    {integrations.outlook_connected ? <Button variant="outline" onClick={() => void saveIntegrations({ ...integrations, outlook_connected: false }, "Outlook disconnected.")}>Disconnect</Button> : <Button asChild><Link href="/api/v1/auth/outlook">Connect Outlook</Link></Button>}
                  </div>
                  <div className="rounded-lg border p-4 space-y-3 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <Plug className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">Extension Sync</p>
                          <p className="text-sm text-muted-foreground">Monitor Chrome extension sync and reconnect session when needed.</p>
                        </div>
                      </div>
                      {extensionSync.loading ? (
                        <Badge variant="outline">Checking...</Badge>
                      ) : extensionSync.connected ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Connected</Badge>
                      ) : (
                        <Badge variant="outline">Not Connected</Badge>
                      )}
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-md border bg-slate-50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Connection status</p>
                        <p className="mt-1 font-medium">
                          {extensionSync.connected ? "Connected" : "Not connected"}
                        </p>
                      </div>
                      <div className="rounded-md border bg-slate-50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Contacts synced via extension</p>
                        <p className="mt-1 font-medium">
                          {extensionSync.loading ? "--" : extensionSync.extensionContactsCount}
                        </p>
                      </div>
                      <div className="rounded-md border bg-slate-50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Last sync</p>
                        <p className="mt-1 font-medium">
                          {extensionSync.lastSyncAt
                            ? `${formatRelativeTimestamp(extensionSync.lastSyncAt)}`
                            : "Never"}
                        </p>
                        {extensionSync.lastSyncAt ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(extensionSync.lastSyncAt).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {extensionSync.error ? (
                      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {extensionSync.error}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (userId) {
                            void loadExtensionSyncStatus(userId);
                          }
                        }}
                        disabled={!userId || extensionSync.loading}
                      >
                        <RefreshCw className={cn("mr-2 h-4 w-4", extensionSync.loading && "animate-spin")} />
                        Refresh Status
                      </Button>
                      <Button onClick={handleExtensionReauth} disabled={reauthLoading}>
                        {reauthLoading ? "Re-authenticating..." : "Re-auth Extension"}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-md bg-orange-100 text-orange-700 font-semibold flex items-center justify-center">Z</div><div><p className="font-medium">Zapier</p><p className="text-sm text-muted-foreground">Automation integration for workflows.</p></div></div><Badge variant="secondary">Coming Soon</Badge></div><Button variant="outline" disabled>Coming Soon</Button></div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Account</DialogTitle><DialogDescription>Type your account email to confirm permanent deletion.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="deleteAccountConfirmEmail">Confirm Email</Label><Input id="deleteAccountConfirmEmail" value={deleteConfirmEmail} onChange={(e) => setDeleteConfirmEmail(e.target.value)} placeholder={email || "you@example.com"} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmEmail(""); }} disabled={deletingAccount}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={deletingAccount}>{deletingAccount ? "Deleting..." : "Delete Account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardShell>
  );
}
