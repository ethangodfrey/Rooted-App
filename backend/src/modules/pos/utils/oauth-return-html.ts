function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Safari on iOS cannot open exp:// or vendorly:// links from an HTTPS page — not
 * via redirect, JavaScript, or tap. Show a manual "switch back to the app" page.
 */
export function renderOAuthReturnHtml(
  status: 'success' | 'error',
  detail?: string,
): string {
  const title = status === 'success' ? 'Square connected' : 'Connection failed';
  const message =
    status === 'success'
      ? 'Close this Safari tab and switch back to the Vendorly app. Point of Sale should show Square as connected.'
      : 'Close this Safari tab, switch back to Vendorly, and try Connect Square again.';
  const detailBlock =
    detail && status === 'error'
      ? `<p class="detail">${escapeHtml(detail.slice(0, 600))}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vendorly - ${title}</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #f8faf8;
      color: #1b4332;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 24px;
      text-align: center;
    }
    .card { max-width: 420px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.75rem; }
    p { color: #52796f; line-height: 1.5; margin-bottom: 1rem; }
    .detail {
      font-size: 0.8rem;
      word-break: break-word;
      background: #fff;
      border: 1px solid #e2e8e2;
      border-radius: 8px;
      padding: 12px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${detailBlock}
  </div>
</body>
</html>`;
}
