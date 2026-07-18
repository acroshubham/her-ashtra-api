export const landingPageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Her Ashtra API</title>
<style>
  :root {
    --bg: #fff1f2;
    --fg: #28131a;
    --accent: #be123c;
    --card: #ffffff;
    --border: rgba(40, 19, 26, 0.12);
  }
  html.dark {
    --bg: #1c0a10;
    --fg: #ffe4e6;
    --accent: #fb7185;
    --card: #2a1119;
    --border: rgba(255, 228, 229, 0.14);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: background 0.2s ease, color 0.2s ease;
  }
  #theme-toggle {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    font-size: 1.5rem;
    line-height: 1;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 999px;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.2s ease;
  }
  #theme-toggle:hover { transform: scale(1.08); }
  main {
    text-align: center;
    padding: 2rem;
  }
  a.title {
    display: inline-block;
    font-size: clamp(2.2rem, 6vw, 3.5rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--fg);
    text-decoration: none;
    border-bottom: 3px solid transparent;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  a.title:hover, a.title:focus-visible {
    color: var(--accent);
    border-color: var(--accent);
  }
  p.subtitle {
    margin-top: 1rem;
    font-size: 1.05rem;
    opacity: 0.75;
  }
  p.subtitle a {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }
  p.subtitle a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <button id="theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">💡</button>
  <main>
    <a class="title" href="/api-docs">HER ASHTRA API</a>
    <p class="subtitle">Hover the title or head to <a href="/api-docs">/api-docs</a> for the full Swagger reference.</p>
  </main>
  <script>
    const root = document.documentElement;
    const toggle = document.getElementById('theme-toggle');
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored ? stored === 'dark' : prefersDark) root.classList.add('dark');
    toggle.addEventListener('click', () => {
      root.classList.toggle('dark');
      localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
    });
  </script>
</body>
</html>
`;
