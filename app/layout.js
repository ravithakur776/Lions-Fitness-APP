import { Outfit, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/src/app/components/theme-provider'

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Lions Fitness',
  description: 'Your fitness journey starts here',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth">
      <body className={`${outfit.variable} ${spaceGrotesk.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
