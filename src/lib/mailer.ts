const nodemailer = require('nodemailer')

const getTransporter = () => {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    return null
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export const sendPasswordResetEmail = async ({
  to,
  name,
  resetUrl,
}: {
  to: string
  name?: string | null
  resetUrl: string
}) => {
  const transporter = getTransporter()
  if (!transporter) return false
  const from = process.env.SMTP_FROM || 'no-reply@sarakan.app'
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset Password',
    text: `Halo${name ? ` ${name}` : ''},\n\nGunakan tautan berikut untuk reset password:\n${resetUrl}\n\nTautan berlaku 30 menit.\n\nJika Anda tidak meminta reset password, abaikan email ini.`,
  })
  return true
}
