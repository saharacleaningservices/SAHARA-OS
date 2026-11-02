import Image from "next/image";

type Category = "Kitchen & Bathroom" | "Sofa & Upholstery" | "Full House Deep Cleaning";

type Card = { src: string; alt: string; category: Category };

const BASE = "/images/before-after";

// Each WebP is a single 265x265 card that already shows the before and after side by side.
const CARDS: Card[] = [
  { src: "kb-toilet-limescale", alt: "Toilet limescale and stain removal, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-bathroom-floor-wall", alt: "Bathroom floor and wall deep scrubbing, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-washbasin", alt: "Washbasin descaling, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-bathroom-tiles", alt: "Bathroom tile and grout cleaning, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-kitchen-sink-granite", alt: "Kitchen sink and granite platform cleaning, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-toilet-seat-result", alt: "Toilet deep cleaning result, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-toilet-bowl", alt: "Toilet bowl stain removal, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-bathroom-floor-tiles", alt: "Bathroom floor tile restoration, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-bathroom-wc-floor", alt: "Bathroom floor grime removal, before and after", category: "Kitchen & Bathroom" },
  { src: "sofa-fabric-red", alt: "Fabric sofa shampooing and stain removal, before and after", category: "Sofa & Upholstery" },
  { src: "sofa-leather-cream", alt: "Cream sofa upholstery cleaning, before and after", category: "Sofa & Upholstery" },
  { src: "fh-terrace-tiles", alt: "Terrace tile cleaning, before and after", category: "Full House Deep Cleaning" },
  { src: "fh-balcony-wood-floor", alt: "Balcony and wooden floor restoration, before and after", category: "Full House Deep Cleaning" },
  { src: "fh-flat-handover-floors", alt: "Flat floor restoration after handover, before and after", category: "Full House Deep Cleaning" },
  { src: "fh-balcony-rack", alt: "Balcony deep cleaning, before and after", category: "Full House Deep Cleaning" },
  { src: "fh-balcony-railing", alt: "Balcony floor and railing cleaning, before and after", category: "Full House Deep Cleaning" },
];

const CATEGORIES: Category[] = ["Kitchen & Bathroom", "Sofa & Upholstery", "Full House Deep Cleaning"];

const BADGE_COLOURS: Record<Category, string> = {
  "Kitchen & Bathroom": "#0e7490",
  "Sofa & Upholstery": "#7c3aed",
  "Full House Deep Cleaning": "#15803d",
};

export default function BeforeAfterSection() {
  return (
    <section aria-labelledby="before-after-heading" className="sahara-ba">
      <style>{`
        .sahara-ba{padding:48px 16px;background:#f8fafc}
        .sahara-ba__inner{max-width:1200px;margin:0 auto}
        .sahara-ba h2{margin:0 0 8px;text-align:center;font-size:clamp(24px,4vw,34px);line-height:1.2;color:#0f172a}
        .sahara-ba__sub{margin:0 auto 28px;max-width:560px;text-align:center;color:#475569;font-size:16px}
        .sahara-ba__row{margin:0 0 24px}
        .sahara-ba__row h3{margin:0 0 12px;font-size:18px;color:#0f172a}
        .sahara-ba__grid{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;-webkit-overflow-scrolling:touch}
        .sahara-ba__card{position:relative;flex:0 0 265px;width:265px;scroll-snap-align:start;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.12)}
        .sahara-ba__card img{display:block;width:265px;height:265px}
        .sahara-ba__badge{position:absolute;left:8px;bottom:8px;padding:4px 10px;border-radius:999px;color:#fff;font-size:12px;font-weight:600;line-height:1.2}
        @media (min-width:900px){.sahara-ba__grid{flex-wrap:wrap;overflow:visible}}
      `}</style>
      <div className="sahara-ba__inner">
        <h2 id="before-after-heading">Real Results From Real Homes in Pune</h2>
        <p className="sahara-ba__sub">Actual before and after photos from Sahara Cleaning Services jobs.</p>
        {CATEGORIES.map((category) => (
          <div className="sahara-ba__row" key={category}>
            <h3>{category}</h3>
            <div className="sahara-ba__grid">
              {CARDS.filter((c) => c.category === category).map((card) => (
                <figure className="sahara-ba__card" key={card.src} style={{ margin: 0 }}>
                  <Image
                    src={`${BASE}/${card.src}.webp`}
                    alt={card.alt}
                    width={265}
                    height={265}
                    loading="lazy"
                    sizes="265px"
                  />
                  <figcaption className="sahara-ba__badge" style={{ background: BADGE_COLOURS[category] }}>
                    {category}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
