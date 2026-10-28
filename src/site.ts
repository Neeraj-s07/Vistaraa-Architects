/**
 * Studio details used across the site. Edit the text here and every page updates.
 * Lines marked TODO still hold placeholders that need the studio's real details.
 *
 * Small formatting helpers in the text below:
 *   *word*    → italic        **word** → bold
 */

export const SITE = {
  name: 'Vistaraa Architects',
  /**
   * The large title on the wall, one line each. On the first scroll the first letters of the two
   * lines (V and A) fly to the top-left corner and become the logo.
   */
  wordmark: ['Vistaraa', 'Architects'],
  /**
   * The site's main address (no trailing slash). The bare domain should redirect here.
   * When Netlify builds the site it uses the address it serves it from instead (its URL setting),
   * so a shared preview link shows its picture; once the domain is connected there, the two match.
   */
  url: (process.env.NETLIFY && process.env.URL) || 'https://www.vistaraaarchitects.com',
  /** Keep false until launch: search engines are asked not to index the site while it is false. */
  live: false,
  /** The line under the big title on the home page. */
  tagline: 'Architecture, interiors & urban design — Ahmedabad',
  /** Used by Google and when a page is shared, unless a page has its own. */
  description:
    'Vistaraa Architects is a design-driven architecture and interiors practice in Ahmedabad, working across India.',
  /** Small print at the foot of the project pages and panels. */
  footer: 'Ahmedabad, Gujarat · Practising pan-India',
};

export const STUDIO = {
  heading: 'Buildings that grow *quieter* with time.',
  lead:
    'Vistaraa Architects is a design-driven practice in Ahmedabad, working across India. Founded and led by principal architects **Vishwas Patel** and **Akshi Dedania**, the studio makes spaces shaped less by trend, more by site, light and the people who live inside them. Every project is led by a founding principal, from first sketch to final detail.',
  /** TODO: confirm these figures with the studio. */
  numbers: [
    { value: '12+', label: 'Years in practice' },
    { value: '60+', label: 'Projects delivered' },
    { value: '02', label: 'Founding principals' },
  ],
  convictions: [
    { title: 'Context first', text: 'No two sites are alike. Climate, orientation and the client’s own rituals of living set the terms of every design.' },
    { title: 'Material honesty', text: 'Concrete, stone, timber and metal, chosen to age well and detailed so their true nature stays visible.' },
    { title: 'Light as instrument', text: 'Daylight is a primary design tool. Sections are drawn around how light enters, moves and changes a room.' },
    { title: 'Restraint', text: 'We remove before we add. A resolved plan is worth more than any ornament.' },
  ],
  /** Portraits live in src/assets/studio/. TODO: confirm both quotes with the founders. */
  founders: [
    {
      name: 'Vishwas Patel',
      role: 'Co-founder & Principal Architect',
      photo: 'vishwas-patel.webp',
      quote: 'The drawing is only ever a proposal. The real design happens on site, in the details.',
    },
    {
      name: 'Akshi Dedania',
      role: 'Co-founder & Principal Architect',
      photo: 'akshi-dedania.webp',
      quote: 'I want a house to understand its owners better each year — never the reverse.',
    },
  ],
  services: [
    'Architecture',
    'Interior design',
    'Urban & master planning',
    'Landscape design',
    'Sustainability consulting',
    'Project management',
  ],
};

export const CONTACT = {
  sub: 'Let’s build something quiet & lasting.',
  /** TODO: the studio's full street address. */
  address: ['Vistaraa Architects', 'Design Studio, Ahmedabad', 'Gujarat 380001, India'],
  /** Listed under "Call". */
  principals: [
    { name: 'Vishwas Patel', phone: '+91 95881 16655' },
    { name: 'Akshi Dedania', phone: '+91 78020 44050' },
  ],
  email: 'info.vistaraaarchitects@gmail.com',
  /** Choices in the enquiry form's "Project type" list. */
  projectTypes: [
    'Residence',
    'Residential development',
    'Commercial / office',
    'Hospitality',
    'Interiors',
    'Masterplanning',
    'Collaboration / press',
  ],
  /**
   * Where the enquiry form sends to. Paste the endpoint URL from a form service
   * (for example Formspree or Web3Forms). While empty, the form only shows a preview
   * "thank you" and nothing is sent.
   */
  formEndpoint: '',
};

/** The Careers panel. TODO: confirm the wording with the studio. */
export const CAREERS = {
  heading: 'Work *with us*',
  lead:
    'We are always glad to hear from architects, interior designers and students who care about detail. If you would like to work with the studio, send us your CV and a portfolio of your work.',
  /** Applications go to this address, with this subject line filled in. */
  email: CONTACT.email,
  subject: 'Application — Vistaraa Architects',
};
