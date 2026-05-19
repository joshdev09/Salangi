import smtplib
import os
import html
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

def send_verification_email(to_email: str, token: str):
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    verification_link = f"{base_url}/api/auth/verify-email?token={token}"

    mail_username = os.getenv("MAIL_USERNAME")
    mail_password = os.getenv("MAIL_PASSWORD")
    mail_from = os.getenv("MAIL_FROM")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your Salangi email"
    msg["From"] = mail_from
    msg["To"] = to_email

    html = f"""
    <h2>Email Verification</h2>
    <p>Hi! Thanks for registering on Salangi.</p>
    <p>Click the link below to verify your email address:</p>
    <a href="{verification_link}">{verification_link}</a>
    <p>This link will expire in 24 hours.</p>
    <p>If you did not register, please ignore this email.</p>
    """

    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(mail_username, mail_password)
        server.sendmail(mail_from, to_email, msg.as_string())


def send_listing_approved_email(to_email: str, business_name: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    dashboard_link = f"{frontend_url}/dashboard/mybusiness"
    business_name = html.escape(business_name)  # prevent HTML injection in email body

    mail_username = os.getenv("MAIL_USERNAME")
    mail_password = os.getenv("MAIL_PASSWORD")
    mail_from = os.getenv("MAIL_FROM")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🎉 Your listing has been approved — {business_name}"
    msg["From"] = mail_from
    msg["To"] = to_email

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#2a2a2a;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">

            <!-- Header -->
            <tr>
              <td style="background:#333333;padding:32px 40px;border-bottom:1px solid #444;">
                <h1 style="margin:0;font-family:Georgia,serif;color:#FFE2A0;font-size:28px;letter-spacing:1px;">Salangi</h1>
                <p style="margin:4px 0 0;color:#FBFAF8;opacity:0.5;font-size:12px;">Angeles City Local Business Directory</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                <div style="text-align:center;margin-bottom:32px;">
                  <div style="display:inline-block;background:#474133;border:1px solid #5a5241;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;text-align:center;">
                    ✅
                  </div>
                </div>

                <h2 style="color:#FFE2A0;font-family:Georgia,serif;font-size:22px;margin:0 0 12px;text-align:center;">
                  Your listing is live!
                </h2>

                <p style="color:#FBFAF8;opacity:0.8;font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
                  Great news! <strong style="color:#FFE2A0;">{business_name}</strong> has been reviewed and approved by our team.
                  Your business is now visible to everyone on Salangi.
                </p>

                <div style="background:#333333;border:1px solid #444;border-radius:12px;padding:20px;margin-bottom:28px;">
                  <p style="color:#FBFAF8;opacity:0.6;font-size:13px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">What's next?</p>
                  <ul style="color:#FBFAF8;opacity:0.8;font-size:14px;line-height:1.8;margin:0;padding-left:18px;">
                    <li>View your listing on the Salangi map</li>
                    <li>Track views and engagement from your dashboard</li>
                    <li>Post events to attract more customers</li>
                  </ul>
                </div>

                <div style="text-align:center;">
                  <a href="{dashboard_link}"
                     style="display:inline-block;background:#FFE2A0;color:#1a1a1a;font-weight:bold;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
                    Go to My Business Dashboard →
                  </a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#222;padding:24px 40px;border-top:1px solid #333;text-align:center;">
                <p style="color:#FBFAF8;opacity:0.3;font-size:12px;margin:0;">
                  You're receiving this because you submitted a listing on Salangi.<br>
                  © Salangi — Angeles City, Pampanga
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """

    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(mail_username, mail_password)
        server.sendmail(mail_from, to_email, msg.as_string())