const otpGenerator = require('otp-generator');
const SibApiV3Sdk = require("sib-api-v3-sdk");



const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const sendVerificationEmail = async (email, otp, subject) => {
  try {
    const response = await tranEmailApi.sendTransacEmail({
      subject,
      htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Furnique OTP</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 0;">
        
        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:#ffffff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.08); padding:32px;">
          
          <!-- Logo / Title -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <h1 style="margin:0; font-size:28px; color:#111827; letter-spacing:1px;">
                Furnique
              </h1>
              <p style="margin:6px 0 0; color:#6b7280; font-size:14px;">
                Premium Furniture Experience
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:10px 0;">
              <hr style="border:none; border-top:1px solid #e5e7eb;">
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:20px 0; color:#374151; font-size:15px; line-height:1.6;">
              <p style="margin:0 0 12px;">
                Hello 👋,
              </p>
              <p style="margin:0 0 16px;">
                Use the OTP belowto securely ${subject}.  
                This code is valid for a short time only.
              </p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td align="center" style="padding:16px 0;">
              <div style="
                display:inline-block;
                padding:14px 28px;
                font-size:26px;
                font-weight:bold;
                letter-spacing:6px;
                color:#111827;
                background:#f9fafb;
                border:1px dashed #d1d5db;
                border-radius:10px;
              ">
                ${otp}
              </div>
            </td>
          </tr>

          <!-- Info -->
          <tr>
            <td style="padding:16px 0; color:#6b7280; font-size:13px; line-height:1.5;">
              <p style="margin:0;">
                If you didn’t request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px; text-align:center; font-size:12px; color:#9ca3af;">
              <p style="margin:0;">
                © 2026 Furnique. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- End Card -->

      </td>
    </tr>
  </table>

</body>
</html>
`,
      sender: {
        name: "Furnique",
        email: process.env.BREVO_FROM_EMAIL, // must be verified in Brevo
      },
      to: [{ email }],
    });

    console.log("✅ Email sent:", response.messageId);
    return true;

  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
};


// Generate OTP
function generateOtp() {
    const otp = otpGenerator.generate(6, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
    });
    return otp;
}

module.exports={generateOtp,sendVerificationEmail}
