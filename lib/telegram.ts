// lib/telegram.ts
// Telegram Bot Integration for Cautio
// Setup: Create bot via @BotFather, get token, add to .env

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID // Your group/channel chat ID

interface TelegramMessage {
  text: string
  photo_url?: string
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env')
    return false
  }

  try {
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
    const data = await response.json()
    return data.ok
  } catch (error) {
    console.error('Telegram error:', error)
    return false
  }
}

export async function sendTelegramPhoto(photoUrl: string, caption: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          photo: photoUrl,
          caption: caption,
          parse_mode: 'HTML'
        })
      }
    )
    const data = await response.json()
    return data.ok
  } catch (error) {
    console.error('Telegram photo error:', error)
    return false
  }
}

// Pre-built message templates
export const TelegramTemplates = {
  issueAssigned: (techName: string, vehicleNo: string, client: string, city: string) =>
    `🔧 <b>Issue Assigned</b>\n\n` +
    `👷 Technician: <b>${techName}</b>\n` +
    `🚗 Vehicle: <b>${vehicleNo}</b>\n` +
    `👤 Client: ${client}\n` +
    `📍 City: ${city}\n` +
    `⏰ Time: ${new Date().toLocaleString('en-IN')}`,

  issueCompleted: (techName: string, vehicleNo: string, client: string) =>
    `✅ <b>Issue Completed</b>\n\n` +
    `👷 Technician: <b>${techName}</b>\n` +
    `🚗 Vehicle: <b>${vehicleNo}</b>\n` +
    `👤 Client: ${client}\n` +
    `⏰ Completed: ${new Date().toLocaleString('en-IN')}`,

  techCheckedIn: (techName: string, location: string) =>
    `📍 <b>Check In</b>\n\n` +
    `👷 ${techName} checked in\n` +
    `📌 Location: ${location}\n` +
    `⏰ Time: ${new Date().toLocaleString('en-IN')}`,

  techCheckedOut: (techName: string, hours: string) =>
    `🏁 <b>Check Out</b>\n\n` +
    `👷 ${techName} checked out\n` +
    `⏱️ Hours worked: ${hours}\n` +
    `⏰ Time: ${new Date().toLocaleString('en-IN')}`,

  lowStock: (itemName: string, quantity: number) =>
    `⚠️ <b>Low Stock Alert</b>\n\n` +
    `📦 Item: <b>${itemName}</b>\n` +
    `🔢 Remaining: ${quantity} units\n` +
    `⏰ ${new Date().toLocaleString('en-IN')}`,

  photoUploaded: (techName: string, vehicleNo: string, photoType: string) =>
    `📷 <b>Photo Uploaded</b>\n\n` +
    `👷 By: ${techName}\n` +
    `🚗 Vehicle: ${vehicleNo}\n` +
    `📸 Type: ${photoType}\n` +
    `⏰ ${new Date().toLocaleString('en-IN')}`,

  paymentReceived: (invoiceNo: string, amount: number, client: string) =>
    `💰 <b>Payment Received</b>\n\n` +
    `📄 Invoice: ${invoiceNo}\n` +
    `👤 Client: ${client}\n` +
    `💵 Amount: ₹${amount.toLocaleString('en-IN')}\n` +
    `⏰ ${new Date().toLocaleString('en-IN')}`
}
