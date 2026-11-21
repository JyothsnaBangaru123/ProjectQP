import os
import smtplib
import threading
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

def get_email_config():
    # Attempt to reload latest configuration from .env file
    try:
        from dotenv import load_dotenv
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
        if os.path.exists(env_path):
            load_dotenv(dotenv_path=env_path, override=True)
    except Exception:
        pass

    return {
        'smtp_server': os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
        'smtp_port': int(os.environ.get('SMTP_PORT', 465)),
        'smtp_username': os.environ.get('SMTP_USERNAME', ''),
        'smtp_password': os.environ.get('SMTP_PASSWORD', ''),
        'smtp_use_tls': os.environ.get('SMTP_USE_TLS', 'True').lower() in ('true', '1', 't'),
        'default_sender': os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@gmrit.edu.in'),
        'sender_name': os.environ.get('MAIL_SENDER_NAME', 'GMRIT QP Management System'),
        'login_url': os.environ.get('APP_LOGIN_URL', 'http://localhost:5173/login'),
        'gmail_webhook_url': os.environ.get('GMAIL_WEBHOOK_URL', os.environ.get('EMAIL_WEBHOOK_URL', '')),
        'brevo_api_key': os.environ.get('BREVO_API_KEY', ''),
        'resend_api_key': os.environ.get('RESEND_API_KEY', '')
    }

def generate_credentials_html(user_name, honorific, per_no, email, password, role_name, branch_name, login_url, is_update=False):
    title_text = "Your Login Credentials have been Updated" if is_update else "Welcome to Question Paper Management Portal"
    subtitle_text = "Your account password was updated by the administrator." if is_update else "Your institutional portal account has been created by the administrator."
    full_name = f"{honorific} {user_name}".strip() if honorific else user_name
    role_display = role_name or 'Faculty / User'
    branch_display = branch_name or 'General Academic Department'

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title_text}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0d0f17;
                color: #e2e8f0;
                margin: 0;
                padding: 24px 12px;
            }}
            .email-container {{
                max-width: 600px;
                margin: 0 auto;
                background: #161926;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
                overflow: hidden;
            }}
            .email-header {{
                background: linear-gradient(135deg, #6366f1 0%, #3b82f6 50%, #06b6d4 100%);
                padding: 28px 24px;
                text-align: center;
                color: #ffffff;
            }}
            .email-header h1 {{
                margin: 0;
                font-size: 22px;
                font-weight: 700;
                letter-spacing: -0.5px;
            }}
            .email-header p {{
                margin: 6px 0 0 0;
                font-size: 13px;
                opacity: 0.9;
            }}
            .email-body {{
                padding: 28px 24px;
            }}
            .greeting {{
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                margin-bottom: 12px;
            }}
            .lead-text {{
                font-size: 14px;
                line-height: 1.6;
                color: #94a3b8;
                margin-bottom: 24px;
            }}
            .credentials-card {{
                background: #1e2235;
                border: 1px solid rgba(99, 102, 241, 0.3);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 24px;
            }}
            .credentials-title {{
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #818cf8;
                font-weight: 700;
                margin-bottom: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                padding-bottom: 8px;
            }}
            .cred-row {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }}
            .cred-row:last-child {{
                border-bottom: none;
            }}
            .cred-label {{
                font-size: 13px;
                color: #94a3b8;
            }}
            .cred-val {{
                font-size: 14px;
                font-weight: 600;
                color: #f1f5f9;
                font-family: monospace;
            }}
            .password-box {{
                background: #0f172a;
                border: 1px dashed #6366f1;
                border-radius: 6px;
                padding: 8px 12px;
                color: #38bdf8;
                font-size: 15px;
                font-weight: 700;
                letter-spacing: 1px;
                font-family: 'Courier New', Courier, monospace;
            }}
            .button-wrapper {{
                text-align: center;
                margin: 32px 0 24px 0;
            }}
            .login-btn {{
                display: inline-block;
                background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
                color: #ffffff !important;
                text-decoration: none;
                font-size: 15px;
                font-weight: 600;
                padding: 14px 32px;
                border-radius: 8px;
                box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
            }}
            .security-notes {{
                background: rgba(234, 179, 8, 0.1);
                border-left: 4px solid #eab308;
                padding: 12px 16px;
                border-radius: 4px;
                font-size: 12px;
                color: #fde047;
                line-height: 1.5;
                margin-bottom: 20px;
            }}
            .email-footer {{
                text-align: center;
                padding: 20px 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                font-size: 12px;
                color: #64748b;
            }}
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <h1>GMR Institute of Technology</h1>
                <p>Automated Question Paper Synthesis & Examination Management System</p>
            </div>
            
            <div class="email-body">
                <div class="greeting">Dear {full_name},</div>
                <div class="lead-text">
                    {subtitle_text} You can now log in to the portal using the credentials provided below.
                </div>
                
                <div class="credentials-card">
                    <div class="credentials-title">🔐 Account Credentials</div>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Personnel Number (per_no)</td>
                            <td style="padding: 8px 0; color: #f1f5f9; font-size: 14px; font-weight: 600; text-align: right; font-family: monospace;">{per_no}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Login Identifier / Username</td>
                            <td style="padding: 8px 0; color: #f1f5f9; font-size: 14px; font-weight: 600; text-align: right;">{user_name} (or {per_no})</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Registered Email</td>
                            <td style="padding: 8px 0; color: #f1f5f9; font-size: 14px; font-weight: 600; text-align: right;">{email}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Assigned Role</td>
                            <td style="padding: 8px 0; color: #a5b4fc; font-size: 14px; font-weight: 600; text-align: right;">{role_display}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Department / Branch</td>
                            <td style="padding: 8px 0; color: #f1f5f9; font-size: 14px; font-weight: 600; text-align: right;">{branch_display}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 0 4px 0; color: #94a3b8; font-size: 13px;">Account Password</td>
                            <td style="padding: 12px 0 4px 0; text-align: right;">
                                <span class="password-box">{password or '********'}</span>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="security-notes">
                    <strong>⚠️ Security Recommendation:</strong> Please keep this password confidential and change it periodically through your profile settings after logging in.
                </div>

                <div class="button-wrapper">
                    <a href="{login_url}" class="login-btn" target="_blank">🚀 Log In to QP Management Portal</a>
                </div>

                <div style="font-size: 12px; color: #64748b; text-align: center; margin-top: 16px;">
                    Portal URL: <a href="{login_url}" style="color: #818cf8;">{login_url}</a>
                </div>
            </div>
            
            <div class="email-footer">
                This is an automated institutional notification from GMRIT QP Management System.<br>
                Please do not reply directly to this email. For technical assistance, contact the examination cell or admin.
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

def is_smtp_configured():
    config = get_email_config()
    return bool(
        (config['smtp_username'] and config['smtp_password']) or
        config.get('gmail_webhook_url') or
        config.get('brevo_api_key') or
        config.get('resend_api_key')
    )

def send_via_https_api(to_email, subject, html_body, plain_body, sender_name, default_sender, config):
    """
    Dispatches email via HTTPS (port 443) to bypass cloud firewall restrictions (such as Render Free Tier).
    Supports:
    1. Google Apps Script Webhook (GMAIL_WEBHOOK_URL)
    2. Brevo REST API (BREVO_API_KEY)
    3. Resend REST API (RESEND_API_KEY)
    """
    import requests

    actual_sender = default_sender
    if config.get('smtp_username') and '@' in config['smtp_username']:
        if default_sender == 'noreply@gmrit.edu.in' or not default_sender:
            actual_sender = config['smtp_username']

    # 1. Google Apps Script Webhook (Direct Gmail forwarding over HTTPS)
    webhook_url = (config.get('gmail_webhook_url') or '').strip().strip('"').strip("'")
    if webhook_url:
        try:
            logger.info(f"Connecting to Google Apps Script Webhook for {to_email}...")
            resp = requests.post(
                webhook_url,
                json={'to': to_email, 'subject': subject, 'html': html_body, 'text': plain_body},
                timeout=15
            )
            if resp.status_code in (200, 302):
                logger.info(f"[SUCCESS] Email delivered via Google Apps Script Webhook to {to_email}")
                print(f"\n[EMAIL DISPATCH] [SUCCESS] Delivered via Google Webhook to: {to_email}\n")
                return True, None
            else:
                logger.warning(f"Google Webhook returned HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Google Webhook error: {e}")

    # 2. Brevo (Sendinblue) API
    brevo_key = (config.get('brevo_api_key') or '').strip().strip('"').strip("'")
    if brevo_key:
        try:
            logger.info(f"Connecting to Brevo HTTPS API for {to_email}...")
            resp = requests.post(
                'https://api.brevo.com/v3/smtp/email',
                headers={'api-key': brevo_key, 'Content-Type': 'application/json', 'Accept': 'application/json'},
                json={
                    'sender': {'name': sender_name, 'email': actual_sender or config.get('default_sender')},
                    'to': [{'email': to_email}],
                    'subject': subject,
                    'htmlContent': html_body,
                    'textContent': plain_body
                },
                timeout=15
            )
            if resp.status_code in (200, 201):
                logger.info(f"[SUCCESS] Email delivered via Brevo to {to_email}")
                print(f"\n[EMAIL DISPATCH] [SUCCESS] Delivered via Brevo to: {to_email}\n")
                return True, None
            else:
                err_msg = f"Brevo API error ({resp.status_code}): {resp.text}"
                logger.error(err_msg)
                return False, err_msg
        except Exception as e:
            logger.error(f"Brevo API request failed: {e}")
            return False, str(e)

    # 3. Resend API
    resend_key = config.get('resend_api_key')
    if resend_key:
        try:
            logger.info(f"Connecting to Resend HTTPS API for {to_email}...")
            resp = requests.post(
                'https://api.resend.com/emails',
                headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'},
                json={
                    'from': f"{sender_name} <{actual_sender or config.get('default_sender')}>",
                    'to': [to_email],
                    'subject': subject,
                    'html': html_body,
                    'text': plain_body
                },
                timeout=15
            )
            if resp.status_code in (200, 201):
                logger.info(f"[SUCCESS] Email delivered via Resend to {to_email}")
                print(f"\n[EMAIL DISPATCH] [SUCCESS] Delivered via Resend to: {to_email}\n")
                return True, None
            else:
                err_msg = f"Resend API error ({resp.status_code}): {resp.text}"
                logger.error(err_msg)
                return False, err_msg
        except Exception as e:
            logger.error(f"Resend API request failed: {e}")
            return False, str(e)

    return None, None

def execute_smtp_send(to_email, subject, html_body, plain_body, sender_name, default_sender, config):
    """
    Directly connects to SMTP server and dispatches email.
    Catches specific exceptions and returns (success: bool, error_message: str | None).
    """
    # 1. Try HTTPS API first if configured (never blocked on cloud platforms like Render)
    if config.get('gmail_webhook_url') or config.get('brevo_api_key') or config.get('resend_api_key'):
        https_ok, https_err = send_via_https_api(to_email, subject, html_body, plain_body, sender_name, default_sender, config)
        if https_ok:
            return True, None
        elif https_ok is False:
            return False, https_err

    try:
        smtp_username = config['smtp_username'].strip()
        smtp_password = config['smtp_password'].replace(' ', '').strip()
        smtp_server = config['smtp_server'].strip()
        smtp_port = config['smtp_port']
        use_tls = config['smtp_use_tls']

        # If sender is using Gmail SMTP, sender address must match authenticated username if MAIL_DEFAULT_SENDER is generic
        actual_sender = default_sender
        if 'gmail.com' in smtp_server.lower() and smtp_username:
            if '@' in smtp_username and (default_sender == 'noreply@gmrit.edu.in' or not default_sender):
                actual_sender = smtp_username

        from_header = f"{sender_name} <{actual_sender}>"

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_header
        msg['To'] = to_email

        # Attach plain text and HTML versions with explicit utf-8 charset
        msg.attach(MIMEText(plain_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))

        if smtp_username and smtp_password:
            logger.info(f"Connecting to SMTP server {smtp_server}:{smtp_port} for {to_email}...")
            server = None
            try:
                # Primary attempt: Try Port 587 STARTTLS (standard for cloud platforms like Render/AWS)
                if smtp_port == 587 or use_tls:
                    server = smtplib.SMTP(smtp_server, 587, timeout=10)
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                else:
                    server = smtplib.SMTP_SSL(smtp_server, 465, timeout=10)
            except Exception as conn_err1:
                logger.warning(f"Primary connection to {smtp_server} failed ({conn_err1}). Trying SSL/TLS fallback...")
                try:
                    server = smtplib.SMTP_SSL(smtp_server, 465, timeout=10)
                except Exception as conn_err2:
                    server = smtplib.SMTP(smtp_server, 587, timeout=10)
                    server.starttls()

            server.login(smtp_username, smtp_password)
            server.send_message(msg)
            server.quit()
            logger.info(f"[SUCCESS] Credentials email successfully delivered to {to_email}")
            print(f"\n[EMAIL DISPATCH] [SUCCESS] Successfully delivered real email via SMTP to: {to_email}\n")
            return True, None
        else:
            # Simulated delivery (logging) when SMTP credentials are not yet configured in .env
            print("\n" + "="*70)
            print(f"[EMAIL SERVICE - SIMULATED DELIVERY (SMTP not configured in .env)]")
            print(f"To: {to_email}")
            print(f"From: {from_header}")
            print(f"Subject: {subject}")
            print("-" * 70)
            print(f"{plain_body.strip()}")
            print("="*70)
            print("NOTE: Set SMTP_USERNAME and SMTP_PASSWORD in backend/.env to send real emails.\n")
            logger.info(f"Simulated email sent to {to_email} (SMTP_USERNAME / SMTP_PASSWORD not set in .env)")
            return True, None

    except smtplib.SMTPAuthenticationError:
        err = "Email authentication failed. Invalid SMTP username or app password in configuration."
        logger.error(f"Failed to send email to {to_email}: {err}")
        print(f"\n[EMAIL ERROR] {err}\n")
        return False, err
    except smtplib.SMTPServerDisconnected:
        err = "SMTP connection closed by server. For Gmail, this happens when Google rejects the credentials (invalid or expired 16-character App Password). Please generate a new App Password at myaccount.google.com/apppasswords."
        logger.error(f"Failed to send email to {to_email}: {err}")
        print(f"\n[EMAIL ERROR] {err}\n")
        return False, err
    except smtplib.SMTPRecipientsRefused:
        err = f"Recipient email address '{to_email}' was rejected by the mail server."
        logger.error(f"Failed to send email to {to_email}: {err}")
        print(f"\n[EMAIL ERROR] {err}\n")
        return False, err
    except smtplib.SMTPSenderRefused:
        err = "Sender email address was rejected by the mail server."
        logger.error(f"Failed to send email to {to_email}: {err}")
        print(f"\n[EMAIL ERROR] {err}\n")
        return False, err
    except (smtplib.SMTPConnectError, ConnectionRefusedError):
        err = f"Could not connect to the SMTP server ({config.get('smtp_server')}:{config.get('smtp_port')})."
        logger.error(f"Failed to send email to {to_email}: {err}")
        print(f"\n[EMAIL ERROR] {err}\n")
        return False, err
    except TimeoutError:
        err = "Connection to the email server timed out. Please check your network connection."
        logger.error(f"Failed to send email to {to_email}: {err}")
        print(f"\n[EMAIL ERROR] {err}\n")
        return False, err
    except Exception as e:
        err_msg = str(e)
        if '101' in err_msg or 'unreachable' in err_msg.lower():
            err = (
                "Cloud firewall block: Render Free Tier blocks outbound SMTP traffic on ports 25, 465, and 587. "
                "To deliver emails from the cloud, add GMAIL_WEBHOOK_URL or BREVO_API_KEY in your Render environment variables."
            )
        elif 'getaddrinfo failed' in err_msg.lower():
            err = "Could not reach email server. Please check your internet connection."
        elif 'connection unexpectedly closed' in err_msg.lower():
            err = "SMTP connection closed by Gmail. Google rejected your App Password (535 Bad Credentials). Please generate a new 16-character App Password at myaccount.google.com/apppasswords."
        else:
            err = f"Email delivery failed: {err_msg}"
        logger.error(f"Failed to send email to {to_email}: {err}")
        print(f"\n[EMAIL ERROR] Could not deliver email to {to_email}: {err}\n")
        return False, err

def _send_email_thread(to_email, subject, html_body, plain_body, sender_name, default_sender, config):
    execute_smtp_send(to_email, subject, html_body, plain_body, sender_name, default_sender, config)

def send_credentials_email(user_data, raw_password, role_name=None, branch_name=None, is_update=False, sync=False):
    """
    Dispatches login credentials to the user's registered email.
    If sync=True, executes immediately and returns real-time delivery status/error.
    If sync=False, dispatches in background thread.
    """
    to_email = user_data.get('email')
    if not to_email:
        logger.warning("No email address provided for user; skipping email delivery.")
        return {'success': False, 'simulated': False, 'message': 'No email address provided'}

    config = get_email_config()
    is_configured = bool(config['smtp_username'] and config['smtp_password'])
    user_name = user_data.get('user_name', '')
    honorific = user_data.get('honorific', '')
    per_no = user_data.get('per_no', '')
    login_url = config['login_url']

    subject = "Your Login Credentials - GMRIT QP Management Portal" if not is_update else "Updated Login Credentials - GMRIT QP Management Portal"

    plain_body = f"""Dear {honorific} {user_name},

{'Your account password was updated by the administrator.' if is_update else 'Your institutional portal account has been created.'}

Here are your login credentials for the GMRIT Question Paper Management Portal:
--------------------------------------------------
Personnel Number: {per_no}
Username: {user_name} (or your personnel number: {per_no})
Registered Email: {to_email}
Assigned Role: {role_name or 'Faculty'}
Department: {branch_name or 'Engineering'}
Password: {raw_password or '********'}
--------------------------------------------------

Portal Login URL: {login_url}

Please keep your credentials safe and change your password periodically.

Regards,
GMR Institute of Technology (Autonomous)
"""

    html_body = generate_credentials_html(
        user_name=user_name,
        honorific=honorific,
        per_no=per_no,
        email=to_email,
        password=raw_password,
        role_name=role_name,
        branch_name=branch_name,
        login_url=login_url,
        is_update=is_update
    )

    if sync:
        success, err_msg = execute_smtp_send(
            to_email, subject, html_body, plain_body, config['sender_name'], config['default_sender'], config
        )
        if not success:
            return {'success': False, 'simulated': False, 'message': err_msg}
        return {
            'success': True,
            'simulated': not is_configured,
            'message': f"Email sent successfully to {user_name} ({to_email})"
        }

    # Dispatch email in background thread to keep API response instantaneous
    thread = threading.Thread(
        target=_send_email_thread,
        args=(to_email, subject, html_body, plain_body, config['sender_name'], config['default_sender'], config),
        daemon=True
    )
    thread.start()

    return {
        'success': True,
        'simulated': not is_configured,
        'message': f"Email sent successfully to {user_name} ({to_email})"
    }

def generate_qp_password_html(recipient_name, paper_title, course_name, password, login_url):
    name_display = recipient_name or "Faculty Member"
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ProjectQP – Password for Finalized Question Paper</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0b1120;
                color: #e2e8f0;
                margin: 0;
                padding: 24px 12px;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                background: #151d30;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                overflow: hidden;
            }}
            .header {{
                background: linear-gradient(135deg, #0284c7 0%, #3b82f6 50%, #6366f1 100%);
                padding: 28px 24px;
                text-align: center;
                color: #ffffff;
            }}
            .header h1 {{
                margin: 0;
                font-size: 22px;
                font-weight: 800;
                letter-spacing: -0.3px;
            }}
            .header p {{
                margin: 6px 0 0 0;
                font-size: 13px;
                opacity: 0.92;
            }}
            .body {{
                padding: 28px 24px;
            }}
            .greeting {{
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                margin-bottom: 12px;
            }}
            .lead-text {{
                font-size: 14px;
                line-height: 1.6;
                color: #cbd5e1;
                margin-bottom: 20px;
            }}
            .paper-card {{
                background: #0f172a;
                border: 1px solid rgba(56, 189, 248, 0.25);
                border-radius: 10px;
                padding: 18px;
                margin-bottom: 22px;
            }}
            .paper-row {{
                margin-bottom: 8px;
                font-size: 13.5px;
            }}
            .paper-row:last-child {{
                margin-bottom: 0;
            }}
            .paper-label {{
                color: #94a3b8;
                font-weight: 500;
            }}
            .paper-val {{
                color: #f8fafc;
                font-weight: 700;
            }}
            .password-section {{
                background: #1e1b4b;
                border: 1px dashed #818cf8;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
                margin-bottom: 22px;
            }}
            .password-label {{
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #a5b4fc;
                font-weight: 700;
                margin-bottom: 8px;
            }}
            .password-code {{
                display: inline-block;
                background: #0f172a;
                border: 1px solid #6366f1;
                border-radius: 6px;
                padding: 10px 20px;
                color: #38bdf8;
                font-size: 18px;
                font-weight: 800;
                letter-spacing: 2px;
                font-family: 'Courier New', Courier, monospace;
            }}
            .security-box {{
                background: rgba(239, 68, 68, 0.1);
                border-left: 4px solid #ef4444;
                padding: 12px 16px;
                border-radius: 4px;
                font-size: 12.5px;
                color: #fca5a5;
                line-height: 1.5;
                margin-bottom: 24px;
            }}
            .footer {{
                text-align: center;
                padding: 18px 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                font-size: 12px;
                color: #64748b;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>GMR Institute of Technology</h1>
                <p>ProjectQP – Automated Examination Management System</p>
            </div>
            <div class="body">
                <div class="greeting">Dear Faculty Member,</div>
                <div class="lead-text">
                    The Head of Department has authorized you to access a finalized examination question paper.
                </div>
                
                <div class="paper-card">
                    <div class="paper-row">
                        <span class="paper-label">Question Paper:</span> 
                        <span class="paper-val">{paper_title}</span>
                    </div>
                    <div class="paper-row">
                        <span class="paper-label">Course:</span> 
                        <span class="paper-val">{course_name}</span>
                    </div>
                </div>

                <div class="password-section">
                    <div class="password-label">The password required to open the protected PDF is:</div>
                    <div class="password-code">{password}</div>
                </div>

                <div class="security-box">
                    <strong>🔒 Confidentiality Notice:</strong> Please keep this password confidential and do not share it with unauthorized individuals.
                </div>

                <div style="text-align: center; margin: 24px 0 16px 0;">
                    <a href="{login_url}" style="background: linear-gradient(135deg, #0284c7 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
                        🚀 Log in to ProjectQP to Download
                    </a>
                </div>
            </div>
            <div class="footer">
                Regards,<br>
                <strong>ProjectQP – Examination Management System</strong><br>
                GMR Institute of Technology (Autonomous)
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

def send_qp_password_email(to_email, recipient_name, paper_title, course_name, password):
    """
    Dispatches the PDF password to an individual authorized faculty recipient.
    Strictly follows Section 6 requirements:
    - Never CCs other recipients.
    - Uses exact subject and body template.
    - Never logs passwords.
    - Returns (success: bool, error_message: str | None).
    """
    config = get_email_config()
    is_configured = is_smtp_configured()

    subject = "ProjectQP – Password for Finalized Question Paper"

    plain_body = f"""Dear Faculty Member,

The Head of Department has authorized you to access a finalized examination question paper.

Question Paper: {paper_title}

Course: {course_name}

The password required to open the protected PDF is:

{password}

Please keep this password confidential and do not share it with unauthorized individuals.

Regards,
ProjectQP – Examination Management System
"""

    html_body = generate_qp_password_html(
        recipient_name=recipient_name,
        paper_title=paper_title,
        course_name=course_name,
        password=password,
        login_url=config.get('login_url', 'http://localhost:5173/login')
    )

    success, err_msg = execute_smtp_send(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        sender_name=config.get('sender_name', 'GMRIT QP Management System'),
        default_sender=config.get('default_sender', 'noreply@gmrit.edu.in'),
        config=config
    )

    return success, err_msg


