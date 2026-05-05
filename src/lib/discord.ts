"use server"

function chunkMessage(message: string, size: number): string[] {
  if (message.length <= size) {
    return [message]
  }
  const chunks: string[] = []
  for (let i = 0; i < message.length; i += size) {
    chunks.push(message.slice(i, i + size))
  }
  return chunks
}

export async function sendDiscordNotification(webhookUrl: string, message: string): Promise<void> {
  const url = webhookUrl.trim()
  const content = message.trim()
  if (!url || !content) {
    return
  }

  const chunks = chunkMessage(content, 1900)
  for (const chunk of chunks) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: chunk }),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Discord webhook failed: ${res.status} ${res.statusText} ${body}`)
    }
  }
}
