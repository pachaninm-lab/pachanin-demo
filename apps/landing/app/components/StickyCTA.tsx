export default function StickyCTA() {
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
      <a href="#contact" className="lux-button block rounded-2xl border border-[rgba(126,242,196,0.16)] bg-brand px-4 py-4 text-center text-sm font-bold text-white shadow-[0_22px_80px_rgba(0,0,0,0.45)]">
        Получить карту потерь
      </a>
    </div>
  );
}
