export const metadata = {
  title: "QuantLog",
  description: "A calm, private CAT quant study tracker",
  manifest: "/manifest.json",
  applicationName: "QuantLog",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "QuantLog" },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport = {
  themeColor: "#14100C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
