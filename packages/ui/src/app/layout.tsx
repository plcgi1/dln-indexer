// packages/ui/src/app/layout.tsx

import "./globals.css"; // Если есть глобальные стили

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body>
        {children}
        </body>
        </html>
    );
}
