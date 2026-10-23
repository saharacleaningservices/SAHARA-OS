// "Our uniform" trust block shown on every landing page and the booking page (owner 2026-10-24): the OFFICIAL Royal Blue Sahara polo,
// logo on the chest and back. Royal Blue only — no grey variant, no alternate logo. The picture is the owner's uniform mock-up
// (public/marketing/uniform-royal-blue.webp), not a photo of staff.
export function UniformStrip() {
  return (
    <section aria-labelledby="uniform-title" className="mx-auto max-w-4xl px-4 py-6">
      <div className="grid items-center gap-4 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        <div className="space-y-2 text-center sm:text-left">
          <h2 id="uniform-title" className="text-lg font-extrabold text-[#0a2540] sm:text-xl">Your Trusted Home Service Partner</h2>
          <p className="text-sm text-[#0a2540]/75">Our trained, verified team arrives in the official Sahara Royal Blue uniform — logo on the chest and the back — so you always know who is at your door.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marketing/uniform-royal-blue.webp" alt="Official Sahara Cleaning Services Royal Blue polo uniform, front and back, with the logo on the chest and the back" width={1200} height={744} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl" />
      </div>
    </section>
  );
}
