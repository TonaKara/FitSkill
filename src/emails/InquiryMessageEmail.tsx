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

type InquiryMessageEmailProps = {
  recipientName: string
  senderName: string
  skillTitle: string
  messageSnippet: string
  chatUrl: string
}

const brandRed = "#e64a19"

export function InquiryMessageEmail({
  recipientName,
  senderName,
  skillTitle,
  messageSnippet,
  chatUrl,
}: InquiryMessageEmailProps) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>{`${senderName}さんから相談メッセージが届きました`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>GritVib 相談チャット通知</Heading>
          <Text style={paragraph}>{recipientName}さん、こんにちは。</Text>
          <Text style={paragraph}>
            <strong>{senderName}</strong>さんから、<strong>{skillTitle}</strong> について新しいメッセージが届きました。
          </Text>

          <Section style={snippetBox}>
            <Text style={snippetLabel}>受信メッセージ</Text>
            <Text style={snippetText}>{messageSnippet}</Text>
          </Section>

          <Section style={buttonWrap}>
            <Button href={chatUrl} style={button}>
              チャットを開く
            </Button>
          </Section>

          <Text style={footnote}>このメールは送信専用です。返信できません。</Text>
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

const snippetLabel: React.CSSProperties = {
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
