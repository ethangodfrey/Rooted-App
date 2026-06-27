import { renderOAuthReturnHtml } from './oauth-return-html';

describe('oauth-return-html', () => {
  it('renders a manual return page without custom-scheme links', () => {
    const html = renderOAuthReturnHtml('success');
    expect(html).toContain('Square connected');
    expect(html).toContain('switch back to the Vendorly app');
    expect(html).not.toContain('href="exp://');
    expect(html).not.toContain('href="vendorly://');
    expect(html).not.toContain('window.location');
  });

  it('shows OAuth error detail on failure', () => {
    const html = renderOAuthReturnHtml('error', 'No pending connection matches this OAuth state.');
    expect(html).toContain('Connection failed');
    expect(html).toContain('No pending connection matches');
  });
});
