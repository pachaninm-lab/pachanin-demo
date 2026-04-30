export default function StickyCTA() {
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
      <div className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-[rgba(126,242,196,0.16)] bg-[#07110E]/95 p-2 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <a href="#contact" className="lux-button rounded-xl bg-brand px-4 py-3 text-center text-sm font-bold text-white">Разобрать сделку</a>
        <a href="tel:+79162778989" className="rounded-xl border border-[rgba(126,242,196,0.14)] px-4 py-3 text-center text-sm font-bold text-[#C9D8D2]">Позвонить</a>
      </div>
    </div>
  );
}
