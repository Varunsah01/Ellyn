import type { LeadScore } from "@/lib/lead-scoring";

export type Contact = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  status: "new" | "contacted" | "responded" | "interested" | "not_interested";
  lastContact: string;
  source: string;
  tags: string[];
  linkedinUrl?: string;
  notes: string;
  emailConfidence?: number;
  emailVerified?: boolean;
  emailSource?: string;
  emailPattern?: string;
  leadScore?: LeadScore;
};
