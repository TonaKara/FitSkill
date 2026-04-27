import { resend } from "../lib/resend"

const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@yourdomain.com"

export async function sendEmail(to: string, subject: string, html: string) {
  return resend.emails.send({
    from: resendFromEmail,
    to,
    subject,
    html,
  })
}
