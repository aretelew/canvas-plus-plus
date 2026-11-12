import type { Kind } from './match';

// What each kind is called, and its line icon, drawn like the popup's: mostly
// Lucide's, with Canvas's own megaphone and speech bubble for posts.
const ICONS: Record<Kind, { name: string; paths: string[] }> = {
  // "book-open"
  course: {
    name: 'Course',
    paths: [
      'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
      'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
    ],
  },
  // "panel-left": a place in a menu
  section: {
    name: 'Page in Canvas',
    paths: [
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
      'M9 3v18',
    ],
  },
  // "users"
  group: {
    name: 'Group',
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
  },
  // "square-pen", like Canvas's page and pencil
  assignment: {
    name: 'Assignment',
    paths: [
      'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
      'M18.4 2.6a1 1 0 0 1 3 3l-9 9a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z',
    ],
  },
  // "circle-help"
  quiz: {
    name: 'Quiz',
    paths: [
      'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
      'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
      'M12 17h.01',
    ],
  },
  discussion: {
    name: 'Discussion',
    paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  },
  announcement: {
    name: 'Announcement',
    paths: ['M3 11l18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
  },
  // "file-text"
  page: {
    name: 'Page',
    paths: [
      'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z',
      'M14 2v4a2 2 0 0 0 2 2h4',
      'M10 9H8',
      'M16 13H8',
      'M16 17H8',
    ],
  },
  // "paperclip"
  file: {
    name: 'File',
    paths: [
      'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
    ],
  },
  // "link"
  link: {
    name: 'Link',
    paths: [
      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
      'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    ],
  },
};

/** What it is, as its icon: named, so it's heard, and shown on hover. */
export function kindIcon(kind: Kind): SVGElement {
  const { name, paths } = ICONS[kind];
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', name);
  const title = document.createElementNS(ns, 'title');
  title.textContent = name;
  svg.append(title);
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
