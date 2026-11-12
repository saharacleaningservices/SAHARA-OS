// Standard questions every service page answers (owner directive 2026-11-12): duration, team size, water / electricity, stains.
// Answers stay factual and hedged where the real figure depends on the job — they match the standard terms on every quotation
// ("customer arranges electricity and water", "100% stain removal is not guaranteed"). Appended to each service's own FAQs and to its FAQPage JSON-LD.

export type Faq = { q: string; a: string };

export function commonServiceFaqs(name: string, opts: { fullHome?: boolean } = {}): Faq[] {
  return [
    {
      q: `How long does ${name} take?`,
      a: opts.fullHome
        ? "A full-home deep clean usually takes a full working day (about 6–8 hours) depending on the size of the home, which is why our team arrives between 8 AM and 2 PM."
        : "Most single-room or single-item services are finished in a few hours. Your confirmation message shows the arrival window; the team lead gives the exact finish time on site.",
    },
    { q: "How many people will come?", a: "A trained team of Sahara staff is assigned according to the size of the job, with a team lead you can speak to. Team details are shared on WhatsApp before arrival." },
    { q: "Do I need to arrange water and electricity?", a: "Please keep electricity and a continuous water supply available (and a stool or ladder where needed). Our team brings the machines, tools and cleaning materials." },
    { q: "Will every stain come out?", a: "We treat old and hard stains to the best of our ability using the right method for each surface. Complete removal cannot be guaranteed without risking damage to the surface, and the team lead will tell you on site if a stain is permanent." },
    { q: "What if I am not happy with the result?", a: "Tell the team lead before they leave, or message us within 48 hours of the service, and we will arrange a re-clean of the affected area at no extra charge." },
  ];
}
