import { NextRequest, NextResponse } from "next/server";
import {
  formatEmail,
  sendEmail,
  refreshAccessToken,
  decryptToken,
  encryptToken,
} from "@/lib/gmail-helper";
import { supabase } from "@/lib/supabase";
import { GmailSendSchema, formatZodError, type GmailSendInput } from "@/lib/validation/schemas";

/**
 * Handle POST requests for `/api/gmail/send`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/gmail/send request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/gmail/send
 * fetch('/api/gmail/send', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  let requestBody: GmailSendInput | null = null;

  try {
    const parsed = GmailSendSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    requestBody = parsed.data;
    const { leadId, to, subject, body: emailBody, isHtml = true } = requestBody;

    // Get Gmail credentials
    const { data: credentials, error: credError } = await supabase
      .from("gmail_credentials")
      .select("*")
      .single();

    if (credError || !credentials) {
      return NextResponse.json(
        { error: "Gmail credentials not found. Please configure Gmail API in settings." },
        { status: 404 }
      );
    }

    // Decrypt access token
    let accessToken = decryptToken(credentials.access_token);

    // Try sending email
    let messageId = "";
    let retryWithRefresh = false;

    try {
      const encodedMessage = formatEmail(to, subject, emailBody, isHtml);
      messageId = await sendEmail(accessToken, encodedMessage);
    } catch (error: unknown) {
      // If 401, try refreshing the token
      if (error instanceof Error && (error.message.includes("401") || error.message.includes("invalid_grant"))) {
        retryWithRefresh = true;
      } else {
        throw error;
      }
    }

    // Retry with refreshed token if needed
    if (retryWithRefresh) {
      const refreshToken = decryptToken(credentials.refresh_token);
      const newAccessToken = await refreshAccessToken(
        refreshToken,
        credentials.client_id,
        credentials.client_secret
      );

      // Update stored access token
      const encryptedNewToken = encryptToken(newAccessToken);
      await supabase
        .from("gmail_credentials")
        .update({ access_token: encryptedNewToken })
        .eq("user_id", credentials.user_id);

      // Retry sending
      const encodedMessage = formatEmail(to, subject, emailBody, isHtml);
      messageId = await sendEmail(newAccessToken, encodedMessage);
    }

    // Log to email_history
    const { error: historyError } = await supabase
      .from("email_history")
      .insert({
        lead_id: leadId,
        to_email: to,
        subject: subject,
        body: emailBody,
        gmail_message_id: messageId,
        status: "sent",
      });

    if (historyError) {
      console.error("Error logging email history:", historyError);
      // Don't fail the request, email was sent successfully
    }

    // Update lead status to 'sent'
    const { error: leadError } = await supabase
      .from("leads")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (leadError) {
      console.error("Error updating lead status:", leadError);
    }

    return NextResponse.json({
      success: true,
      messageId: messageId,
      message: "Email sent successfully",
    });
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send email";

    // Log failed attempt to email_history
    try {
      await supabase.from("email_history").insert({
        lead_id: requestBody?.leadId ?? null,
        to_email: requestBody?.to ?? null,
        subject: requestBody?.subject ?? null,
        body: requestBody?.body ?? null,
        status: "failed",
      });
    } catch (logError) {
      console.error("Error logging failed email:", logError);
    }

    return NextResponse.json(
      { error: errorMessage || "Failed to send email" },
      { status: 500 }
    );
  }
}
