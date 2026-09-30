// Base HTML Layout with Canadian White-Label Branding & AGPL-3.0 Compliance

export interface LayoutOptions {
  title?: string;
  brandName?: string;
  user?: { name: string; email: string; username?: string | null } | null;
  children: string;
}

export function htmlLayout(options: LayoutOptions): string {
  const brand = options.brandName || 'TrueNorth Bookings';
  const title = options.title ? `${options.title} | ${brand}` : `${brand} — Made in Canada 🇨🇦`;

  const navLinks = options.user
    ? `
      <div class="flex items-center gap-4 text-sm font-medium">
        <a href="/dashboard" class="text-gray-700 hover:text-red-600 transition">Dashboard</a>
        <a href="/dashboard/bookings" class="text-gray-700 hover:text-red-600 transition">Bookings</a>
        <a href="/dashboard/event-types" class="text-gray-700 hover:text-red-600 transition">Services</a>
        <a href="/dashboard/settings" class="text-gray-700 hover:text-red-600 transition">Profile & Tax</a>
        ${options.user.username ? `<a href="/u/${options.user.username}" target="_blank" class="text-red-600 hover:underline">View Live Page ↗</a>` : ''}
        <form action="/auth/logout" method="POST" class="inline m-0">
          <button type="submit" class="text-gray-500 hover:text-red-600 text-xs px-2.5 py-1 border border-gray-300 rounded hover:border-red-400 transition">Log Out</button>
        </form>
      </div>
    `
    : `
      <div class="flex items-center gap-4 text-sm">
        <a href="/auth/login" class="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium text-xs shadow-sm transition">Vendor Login</a>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen flex flex-col antialiased">
  <!-- Top Canadian Banner -->
  <div class="bg-red-700 text-white text-xs py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-1.5">
    <span>🇨🇦</span>
    <span>TrueNorth Bookings · Made in Canada · Built for Canadian Independent Vendors</span>
  </div>

  <!-- Header -->
  <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2.5 font-bold text-gray-900 text-lg hover:text-red-600 transition">
        <span class="text-2xl">🍁</span>
        <span>${brand}</span>
      </a>
      <nav>${navLinks}</nav>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
    ${options.children}
  </main>

  <!-- AGPL-3.0 Footer -->
  <footer class="bg-white border-t border-gray-200 mt-auto py-6">
    <div class="max-w-6xl mx-auto px-4 text-center text-xs text-gray-500 space-y-1">
      <p>Made in Canada 🇨🇦 · Powered by calrs (AGPL-3.0) — <a href="https://github.com/pal404error/calender.diy" target="_blank" rel="noopener" class="underline hover:text-red-600">source</a></p>
      <p class="text-gray-400">All prices in Canadian Dollars ($ CAD). Secure serverless infrastructure on Cloudflare Workers + D1.</p>
    </div>
  </footer>
</body>
</html>`;
}
