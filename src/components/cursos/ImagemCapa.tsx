"use client";
import Image from "next/image";
import { useState } from "react";
import { BookOpen } from "lucide-react";
export function ImagemCapa({ src, sizes, className = "" }: { src: string | null; sizes: string; className?: string }) {
  const [falhou, setFalhou] = useState<string | null>(null);
  return <span className={"absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand via-frame to-frame-deep " + className}>
    <BookOpen className="h-1/3 w-1/3 text-white/30" strokeWidth={1.3} aria-hidden="true" />
    {src && falhou !== src && <Image src={src} alt="" fill sizes={sizes} className="object-cover" onError={() => setFalhou(src)} />}
  </span>;
}
