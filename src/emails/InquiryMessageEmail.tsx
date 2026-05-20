import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"
import {
  formatMessage,
  getDictionary,
  lookupMessage,
} from "@/lib/i18n/dictionaries"
import { DEFAULT_LOCALE, localeToHtmlLang, type Locale } from "@/lib/i18n/locales"

type InquiryMessageEmailProps = {
  recipientName: string
  senderName: string
  skillTitle: string
  messageSnippet: string
  chatUrl: string
  /**
   * メール本文の言語。未指定の場合は 'ja'（既存の挙動と完全に一致）。
   */
  locale?: Locale
}

const brandRed = "#e64a19"

export function InquiryMessageEmail({
  recipientName,
  senderName,
  skillTitle,
  messageSnippet,
  chatUrl,
  locale,
}: InquiryMessageEmailProps) {
  const effectiveLocale: Locale = locale ?? DEFAULT_LOCALE
  const dict = getDictionary(effectiveLocale)
  const tr = (key: string, values?: Record<string, string | number>): string => {
    const raw = lookupMessage(dict, key)
    return formatMessage(raw, values)
  }
  const previewText = tr("email.inquiryMessage.preview", { sender: senderName })
  const headingText = tr("email.inquiryMessage.heading")
  const greetingText = tr("email.inquiryMessage.greeting", { recipient: recipientName })
  const snippetLabel = tr("email.inquiryMessage.snippetLabel")
  const ctaText = tr("email.inquiryMessage.cta")
  const footerText = tr("email.footer")
  const bodyTemplate = tr("email.inquiryMessage.body")
  // 本文に <strong> を埋め込むため、プレースホルダ位置で分割する。
  const bodyParts = bodyTemplate.split(/\{(sender|skill)\}/g)

  return (
    <Html lang={localeToHtmlLang(effectiveLocale)}>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>{headingText}</Heading>
          <Text style={paragraph}>{greetingText}</Text>
          <Text style={paragraph}>
            {bodyParts.map((part, index) => {
              if (part === "sender") {
                return <strong key={`sender-${index}`}>{senderName}</strong>
              }
              if (part === "skill") {
                return <strong key={`skill-${index}`}>{skillTitle}</strong>
              }
              return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
            })}
          </Text>

          <Section style={snippetBox}>
            <Text style={snippetLabelStyle}>{snippetLabel}</Text>
            <Text style={snippetText}>{messageSnippet}</Text>
          </Section>

          <Section style={buttonWrap}>
            <Button href={chatUrl} style={button}>
              {ctaText}
            </Button>
          </Section>

          <Text style={footnote}>{footerText}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default InquiryMessageEmail

const main: React.CSSProperties = {
  backgroundColor: "#09090b",
  margin: 0,
  padding: "32px 12px",
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  color: "#f4f4f5",
}

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "16px",
  padding: "28px",
}

const heading: React.CSSProperties = {
  margin: "0 0 18px",
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 800,
}

const paragraph: React.CSSProperties = {
  margin: "0 0 12px",
  color: "#e4e4e7",
  fontSize: "14px",
  lineHeight: "1.7",
}

const snippetBox: React.CSSProperties = {
  marginTop: "10px",
  borderRadius: "12px",
  border: "1px solid #3f3f46",
  backgroundColor: "#111114",
  padding: "14px",
}

const snippetLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#a1a1aa",
  fontSize: "12px",
  fontWeight: 700,
}

const snippetText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#fafafa",
  fontSize: "14px",
  lineHeight: "1.65",
  whiteSpace: "pre-wrap",
}

const buttonWrap: React.CSSProperties = {
  marginTop: "20px",
  textAlign: "center",
}

const button: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: brandRed,
  color: "#ffffff",
  borderRadius: "10px",
  fontWeight: 700,
  fontSize: "14px",
  textDecoration: "none",
  padding: "12px 22px",
}

const footnote: React.CSSProperties = {
  marginTop: "22px",
  color: "#71717a",
  fontSize: "12px",
  lineHeight: "1.6",
}
