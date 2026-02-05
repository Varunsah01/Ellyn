import { NextRequest, NextResponse } from "next/server";
import {
  formatEmail,
  sendEmail,
  refreshAccessToken,
  decryptToken,
  encryptToken,
} from "@/lib/gmail-helper";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, to, subject, body: emailBody, isHtml = true } = body;

    // Validate required fields
    if (!leadId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: leadId, to, subject, body" },
        { status: 400 }
      );
    }

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
    let emailSent = false;
    let messageId = "";
    let retryWithRefresh = false;

    try {
      const encodedMessage = formatEmail(to, subject, emailBody, isHtml);
      messageId = await sendEmail(accessToken, encodedMessage);
      emailSent = true;
    } catch (error: any) {
      // If 401, try refreshing the token
      if (error.message?.includes("401") || error.message?.includes("invalid_grant")) {
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
      emailSent = true;
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
  } catch (error: any) {
    console.error("Error sending email:", error);

    // Log failed attempt to email_history
    try {
      const body = await request.json();
      await supabase.from("email_history").insert({
        lead_id: body.leadId,
        to_email: body.to,
        subject: body.subject,
        body: body.body,
        status: "failed",
      });
    } catch (logError) {
      console.error("Error logging failed email:", logError);
    }

    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
