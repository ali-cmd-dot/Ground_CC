// app/api/telegram/route.ts
// Server-side Telegram sender (keeps token safe)

import { NextRequest, NextResponse } from 'next/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function POST(req: NextRequest) {
  try {
    const { message, photo_url, caption } = await req.json()

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return NextResponse.json({ success: false, error: 'Telegram not configured' })
    }

    let result

    if (photo_url) {
      // Send photo with caption
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            photo: photo_url,
            caption: caption || '',
            parse_mode: 'HTML'
          })
        }
      )
      result = await response.json()
    } else {
      // Send text message
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
          })
        }
      )
      result = await response.json()
    }

    return NextResponse.json({ success: result.ok, result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
