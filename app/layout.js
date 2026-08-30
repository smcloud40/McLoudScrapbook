export const metadata = {
  title: 'Scrapbook',
  description: 'A digital scrapbook you build with real supplies.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
