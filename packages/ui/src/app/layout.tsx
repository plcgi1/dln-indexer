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
        {/* Все твои страницы (page.tsx) будут вставляться сюда вместо {children} */}
        {children}
        </body>
        </html>
    );
}