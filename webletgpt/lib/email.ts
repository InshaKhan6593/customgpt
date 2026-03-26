import { Resend } from "resend";

// A mock instance is used if the API key is not yet set
const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key");

/**
 * Sends a magic link verification email using Resend.
 */
export async function sendVerificationRequest(params: {
  identifier: string; // the email address
  url: string; // the login URL containing the token
}) {
  const { identifier, url } = params;

  // In NextAuth v5, Resend Provider by default sends the token inside a full URL.
  // The segment instructions requested a "6-digit OTP code input within the same card".
  // Note: To cleanly implement a true 6-digit OTP input that stays on the same page,
  // typically requires a custom credentials provider or building a manual verification
  // API on top of NextAuth. For now, since NextAuth EmailProvider strictly relies on
  // magic link URLs `/api/auth/callback/resend?token=CODE`, we will extract the token
  // from the URL to display it.

  let token = "";
  try {
    const tokenUrl = new URL(
      url,
      process.env.NEXTAUTH_URL || "http://localhost:3000",
    );
    token = tokenUrl.searchParams.get("token") || "";
  } catch (e) {
    console.error("URL parse error in sendVerificationRequest:", e);
    // Fallback parsing just in case
    const match = url.match(/token=([^&]+)/);
    if (match) token = match[1];
  }

  // Log OTP to console in development so local dev works without a verified Resend domain
  if (process.env.NODE_ENV === "development") {
    console.log(
      `\n========================================\n` +
        `  [DEV] Login OTP for ${identifier}: ${token}\n` +
        `========================================\n`,
    );
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "WebletGPT <noreply@webletgpt.com>", // Update this to verified domain when going to prod
      to: [identifier],
      subject: `Sign in to WebletGPT`,
      text: `Sign in to WebletGPT\n\nYour login code is: ${token}\n\nAlternatively, click here to log in: ${url}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome to WebletGPT!</h2>
          <p>Please use the following 6-character code to sign in securely:</p>
          <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <strong style="font-size: 24px; letter-spacing: 4px;">${token}</strong>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #71717a; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API error:", error);
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[DEV] Email delivery failed — use the OTP code logged above to sign in locally.",
        );
        return;
      }
      throw new Error(`Failed to send verification email: ${error.message}`);
    }

    console.log("Verification email sent successfully:", data?.id);
  } catch (error) {
    console.error("Failed to send verification email:", error);
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[DEV] Email send threw an error — use the OTP code logged above to sign in locally.",
      );
      return;
    }
    throw new Error("Failed to send verification email.");
  }
}
