export const metadata = {
  title: "QuantLog",
  description: "A calm, private CAT quant study tracker",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "QuantLog" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport = { themeColor: "#0D0B09", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
