/* house.js — la forma de la casa (data/site.json y projects/<slug>/project.json)
   → la del data.json de antes, que es la que leen carousel.js, ui.js y
   about.js. La usan js/carga.js y el build. No toca el disco. */

export const slugsOf = (site) => Object.values(site.lists).flat();

export function toOld(site, projects) {
  return {
    categories: Object.entries(site.lists).map(([cat, slugs]) => ({
      slug: cat,
      label: site.categories[cat],
      projects: slugs.map((slug) => {
        const p = projects[slug];
        return {
          slug, title: p.title, role: p.role, studio: p.studio ?? '',
          videoPath: `projects/${slug}/video.webm`,
          start: p.start ?? 0, finish: p.finish ?? null,
          highlight: p.highlight !== false, visible: p.visible !== false,
        };
      }),
    })),
    about: { title: site.about.title, name: site.about.name, clase: site.about.class },
    contacto: { label: site.contact.label, name: site.contact.name, clase: site.contact.class ?? '', email: site.contact.email, texto: site.contact.text },
  };
}
