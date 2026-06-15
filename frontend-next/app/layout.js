export const metadata = {
  title: "Kimure",
  description: "Kimure AI Brokerage Platform"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

