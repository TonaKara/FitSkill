import { resend } from "../lib/resend"

const resendFromEmail = process.env.RESEND_FROM_EMAIL

if (!resendFromEmail) {
  throw new Error("RESEND_FROM_EMAIL is not set")
}

export async function sendEmail(to: string, subject: string, html: string) {
  return resend.emails.send({
    from: resendFromEmail,
    to,
    subject,
    html,
  })
}
