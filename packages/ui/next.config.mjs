/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["dlni-shared"],
    experimental: {
        externalDir: true, // Позволяет импорты из папок вне packages/ui
    },
};

// Исправлено: используем export default вместо module.exports
export default nextConfig;