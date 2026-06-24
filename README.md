# Glenn HS — English Honors Society (site)

This project is a small static website. I modernized the styling and layout to improve typography, accessibility, and responsiveness.

What I changed
- Rewrote `css/style.css` for a modern responsive design using CSS variables and improved components.
- Standardized the header across pages (brand, nav, mobile toggle).
- Added Google Fonts (Playfair Display + Inter) to pages.
- Added a simple favicon at `assets/favicon.svg` and theme-color meta tag.
- Added a class-based mobile nav toggle in `js/main.js`.

Preview locally
1. From the project root run a simple HTTP server (recommended so ES modules work correctly):

```powershell
python -m http.server 8000
```

2. Open http://localhost:8000 in your browser.

Notes & next steps
- I standardized the head on the main pages; if you have additional pages, I'll update them too.
- Consider adding real images for the hero and events, optimized (webp/avif) and lazy-loaded.
- If you want animations or a dark theme toggle, I can add them.
- For production, compress and optimize `assets/images` and consider a CDN.

If you'd like me to continue, I can automatically proceed with these next steps:
- Update any remaining pages that still have legacy header/footer markup.
- Add lightweight SVG UI icons (navigation, external links, social) and replace text-only controls.
- Create sample hero/background imagery and wire it into the homepage with responsive sizes.
- Implement a small design tokens JSON/CSS partial to make future theming easier.

Tell me which of those you'd like me to do next, or say "Do everything" and I'll continue applying the remaining items on the todo list.
## Upgrades
- Migrate to Firebase Auth & Firestore for per-officer accounts.
- Add Netlify Identity + Git Gateway for direct publishing from admin UI.
- Add image uploads (S3 or Netlify Large Media).

Enjoy! — tell me which page or piece you want me to modify next (colors, hero photo, admin auth upgrade, Netlify steps).
