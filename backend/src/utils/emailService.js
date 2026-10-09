import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
            console.warn(
                "[Email Service] Email configuration missing. Emails will not be sent."
            );
            return null;
        }

        transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: parseInt(env.SMTP_PORT),
            secure: env.SMTP_SECURE, // true for 465, false for other ports
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASSWORD
            }
        });
    }
    return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
    const emailTransporter = getTransporter();

    if (!emailTransporter) {
        console.log(`[Email Service] Email not sent (not configured): ${subject} to ${to}`);
        return { success: false, message: "Email service not configured" };
    }

    try {
        const mailOptions = {
            from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
            to: Array.isArray(to) ? to.join(", ") : to,
            subject,
            text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
            html
        };

        console.log(`[Email Service] Attempting to send email: ${subject} to ${to}`);
        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`[Email Service] Email sent successfully: ${subject} to ${to}, messageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email Service] Error sending email to ${to}:`, error.message);
        console.error(`[Email Service] Full error:`, error);
        return { success: false, error: error.message };
    }
};

export const verifyEmailConfig = async () => {
    const emailTransporter = getTransporter();
    if (!emailTransporter) {
        return false;
    }

    try {
        await emailTransporter.verify();
        console.log("[Email Service] Email configuration verified");
        return true;
    } catch (error) {
        console.error("[Email Service] Email configuration verification failed:", error);
        return false;
    }
};
