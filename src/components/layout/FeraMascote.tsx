import Image from "next/image";

export function FeraMascote() {
  return (
    <div className="fera-mascote pointer-events-none absolute bottom-4 left-4 z-20 w-16 select-none sm:w-20 lg:fixed lg:bottom-6 lg:left-6 lg:w-28 xl:w-32">
      <div className="fera-mascote-corpo">
        <Image src="/fera-mascote.png" alt="Fera, mascote do Colégio Status, dando boas-vindas" width={1076} height={1462} sizes="(min-width: 1280px) 128px, (min-width: 1024px) 112px, (min-width: 640px) 80px, 64px" className="h-auto w-full drop-shadow-[0_12px_14px_rgba(0,0,0,0.3)]" />
      </div>
      <div aria-hidden="true" className="fera-mascote-sombra mx-auto mt-1 h-2 w-3/5 rounded-[50%] bg-black/25 blur-sm" />
    </div>
  );
}
