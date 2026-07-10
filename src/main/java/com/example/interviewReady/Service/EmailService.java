package com.example.interviewReady.Service;

import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendVerificationCode(String toEmail, String firstName, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("interviewreadymena@gmail.com");
            helper.setTo(toEmail);
            helper.setSubject("InterviewReady - Verify Your Email");
            helper.setText(buildHtmlEmail(firstName, code), true);

            mailSender.send(message);
        } catch (Exception e) {
            String rootCause = e.getMessage();
            if (e.getCause() != null) {
                rootCause = e.getCause().getMessage();
            }
            throw new RuntimeException("Email failed: " + rootCause, e);
        }
    }

    private String buildHtmlEmail(String firstName, String code) {
        // Split the 6-digit code into individual characters for the digit boxes
        String digitBoxes = "";
        for (char c : code.toCharArray()) {
            digitBoxes += """
                <td style="width:48px; height:56px; text-align:center; vertical-align:middle; \
                background-color:#f8f9fc; border:1px solid #e2e5f1; border-radius:10px; \
                font-size:28px; font-weight:700; color:#0f1629; font-family:'SF Pro Display',Arial,sans-serif; \
                letter-spacing:0;">""" + c + "</td><td style=\"width:8px;\"></td>";
        }

        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin:0; padding:0; background-color:#f0f2f5; font-family:'SF Pro Display','Segoe UI',Arial,sans-serif; -webkit-font-smoothing:antialiased;">
                    <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5; padding:48px 16px;">
                        <tr>
                            <td align="center">
                                <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.08);">

                                    <!-- Header with Logo -->
                                    <tr>
                                        <td style="background:linear-gradient(160deg, #0a0e1a 0%%, #111827 40%%, #1e293b 100%%); padding:40px 40px 36px 40px; text-align:center;">
                                            <img src="https://interviewready-uploads.s3.eu-north-1.amazonaws.com/ir-logo.png"
                                                 alt="InterviewReady"
                                                 width="160"
                                                 style="display:block; margin:0 auto 16px auto; max-width:160px; height:auto;" />
                                            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                                <tr>
                                                    <td style="width:40px; height:1px; background:linear-gradient(90deg, transparent, rgba(99,102,241,0.4));"></td>
                                                    <td style="padding:0 12px;">
                                                        <p style="color:rgba(148,163,184,0.9); margin:0; font-size:12px; font-weight:500; letter-spacing:2.5px; text-transform:uppercase;">Email Verification</p>
                                                    </td>
                                                    <td style="width:40px; height:1px; background:linear-gradient(90deg, rgba(99,102,241,0.4), transparent);"></td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Body -->
                                    <tr>
                                        <td style="padding:44px 40px 20px 40px;">
                                            <p style="color:#0f1629; font-size:20px; font-weight:600; margin:0 0 8px 0; line-height:1.3;">Hello, %s</p>
                                            <p style="color:#64748b; font-size:15px; line-height:1.7; margin:0 0 36px 0;">
                                                Thanks for signing up. Enter the code below in the app to verify your email address and activate your account.
                                            </p>

                                            <!-- Code Display -->
                                            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px auto;">
                                                <tr>
                                                    %s
                                                </tr>
                                            </table>

                                            <!-- Timer Badge -->
                                            <table cellpadding="0" cellspacing="0" style="margin:0 auto 36px auto;">
                                                <tr>
                                                    <td style="background-color:#fef3c7; border-radius:20px; padding:8px 20px;">
                                                        <p style="color:#92400e; font-size:12px; font-weight:600; margin:0; letter-spacing:0.3px;">
                                                            &#9202; Expires in 10 minutes
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>

                                            <!-- Divider -->
                                            <table width="100%%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                                                <tr><td style="height:1px; background:linear-gradient(90deg, transparent, #e2e8f0, transparent);"></td></tr>
                                            </table>

                                            <!-- Security Notice -->
                                            <table cellpadding="0" cellspacing="0" style="width:100%%;">
                                                <tr>
                                                    <td style="width:20px; vertical-align:top; padding-top:2px;">
                                                        <span style="font-size:14px;">&#128274;</span>
                                                    </td>
                                                    <td style="padding-left:8px;">
                                                        <p style="color:#94a3b8; font-size:12.5px; line-height:1.6; margin:0;">
                                                            If you didn't create an account with InterviewReady, you can safely ignore this email. No action is needed.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="background-color:#f8fafc; padding:24px 40px; border-top:1px solid #f1f5f9;">
                                            <table width="100%%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center">
                                                        <p style="color:#94a3b8; font-size:11.5px; margin:0 0 6px 0; letter-spacing:0.2px;">
                                                            &copy; 2026 InterviewReady &mdash; AI-Powered Mock Interviews
                                                        </p>
                                                        <p style="color:#cbd5e1; font-size:11px; margin:0;">
                                                            Automated message &middot; Please do not reply
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """.formatted(firstName, digitBoxes);
    }
}
