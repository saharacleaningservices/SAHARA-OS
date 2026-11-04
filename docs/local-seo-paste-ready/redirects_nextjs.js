// Paste into the public site next.config.js. Usage:
//   const { batch1 } = require("./redirects_nextjs");   // deploy Batch 1 first
//   async redirects() { return [...batch1]; }            // add ...batch2 only after the Batch 1 go/no-go
// permanent: true = HTTP 308 in Next.js, which Google treats as a permanent redirect (same as 301).
// For a literal 301, add the same rules at the CDN/proxy layer instead.
// Sources have no trailing slash: Next.js already 308s "/pune/x/" to "/pune/x", which would be a
// second hop. Keep the sitemap and every internal link on the final URL so crawlers never hit the chain.
const batch1 = [
  { source: "/pune/magarpatta", destination: "/cleaning-services-magarpatta-411028", permanent: true },
  { source: "/pune/hadapsar", destination: "/cleaning-services-hadapsar-411028", permanent: true },
  { source: "/pune/kharadi", destination: "/cleaning-services-kharadi-411014", permanent: true },
  { source: "/pune/undri", destination: "/cleaning-services-undri-411060", permanent: true },
  { source: "/pune/mohammadwadi", destination: "/cleaning-services-mohammadwadi-411060", permanent: true },
  { source: "/pune/nibm", destination: "/cleaning-services-nibm-road-411048", permanent: true },
  { source: "/pune/kondhwa", destination: "/cleaning-services-kondhwa-411048", permanent: true },
];
const batch2 = [
  { source: "/pune/viman-nagar", destination: "/cleaning-services-viman-nagar-411014", permanent: true },
  { source: "/pune/wagholi", destination: "/cleaning-services-wagholi-412207", permanent: true },
  { source: "/pune/baner", destination: "/cleaning-services-baner-411045", permanent: true },
  { source: "/pune/wakad", destination: "/cleaning-services-wakad-411057", permanent: true },
  { source: "/pune/hinjewadi", destination: "/cleaning-services-hinjewadi-411057", permanent: true },
  { source: "/pune/aundh", destination: "/cleaning-services-aundh-411007", permanent: true },
  { source: "/pune/kothrud", destination: "/cleaning-services-kothrud-411038", permanent: true },
];
module.exports = { batch1, batch2 };
