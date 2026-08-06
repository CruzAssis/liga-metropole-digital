import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Escudo da Liga Metrópole em SVG inline.
 *
 * Substitui a versão anterior, que importava src/assets/liga-metropole-logo.png.asset.json
 * e apontava para /__l5e/assets-v1/... — rota interna da Lovable que NÃO existe na Vercel.
 * Em produção aquilo retornava 404 e o cabeçalho ficava com imagem quebrada.
 *
 * Vantagens do inline: nítido em qualquer densidade de tela, zero requisição de rede,
 * sem dependência de CDN de terceiro, e herda cor do tema quando preciso.
 */
export function BrandLogo({
  className,
  alt = "Liga Metrópole",
}: {
  className?: string;
  alt?: string;
}) {
  // useId evita colisão de id do clipPath quando o logo aparece mais de uma
  // vez na mesma página (cabeçalho + rodapé, por exemplo). Ids de SVG são
  // globais no documento: duplicar quebra o recorte do skyline.
  const clipId = `lm-skyline-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="90 48 500 700"
      role="img"
      aria-label={alt}
      className={cn("object-contain shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{alt}</title>

      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          {/* textLength + lengthAdjust travam a largura do "LM" em 464 unidades.
              Assim o desenho fica igual mesmo onde a fonte Impact não existe
              (Android, algumas distribuições Linux). */}
          <text
            x="108"
            y="378"
            fontFamily="Impact, 'Arial Black', 'Haettenschweiler', sans-serif"
            fontSize="300"
            textLength="464"
            lengthAdjust="spacingAndGlyphs"
          >
            LM
          </text>
        </clipPath>
      </defs>

      {/* Contorno branco do escudo */}
      <path
        fill="#FFFFFF"
        d="M 90,48 L 590,48 L 590,462 C 590,632 418,728 340,748 C 262,728 90,632 90,462 Z"
      />

      {/* Miolo escuro */}
      <path
        fill="#0C0C18"
        d="M 108,66 L 572,66 L 572,458 C 572,616 414,708 340,726 C 266,708 108,616 108,458 Z"
      />
      <path
        fill="none"
        stroke="#1A1A2C"
        strokeWidth="1.5"
        d="M 108,66 L 572,66 L 572,458 C 572,616 414,708 340,726 C 266,708 108,616 108,458 Z"
      />

      {/* Letras LM */}
      <text
        x="108"
        y="378"
        fontFamily="Impact, 'Arial Black', 'Haettenschweiler', sans-serif"
        fontSize="300"
        textLength="464"
        lengthAdjust="spacingAndGlyphs"
        fill="#FFFFFF"
      >
        LM
      </text>

      {/* Skyline de São Paulo recortado dentro das letras */}
      <path
        clipPath={`url(#${clipId})`}
        fill="#1565F5"
        d="M 108,378 V 356 H 120 V 368 H 125 V 340 H 138 V 374 H 144 V 318 H 160 V 357 H 166 V 294 H 184 V 344 H 196 V 322 H 208 V 367 H 214 V 340 H 228 V 354 H 248 V 292 H 272 V 332 H 283 V 312 H 298 V 350 H 310 V 298 H 328 V 360 H 342 V 328 H 357 V 348 H 370 V 316 H 388 V 355 H 400 V 332 H 416 V 356 H 430 V 308 H 452 V 348 H 465 V 335 H 485 V 360 H 500 V 300 H 520 V 346 H 533 V 325 H 550 V 360 H 560 V 350 H 572 V 378 Z"
      />

      {/* Divisor */}
      <line x1="152" y1="400" x2="528" y2="400" stroke="#1565F5" strokeWidth="1.5" />
      <circle cx="141" cy="400" r="3.5" fill="#1565F5" />
      <circle cx="539" cy="400" r="3.5" fill="#1565F5" />

      {/* Bola */}
      <g transform="translate(340,510)">
        <circle r="50" fill="#0C0C18" stroke="#FFFFFF" strokeWidth="2.5" />
        <polygon points="0,-16 15.2,-4.9 9.4,12.9 -9.4,12.9 -15.2,-4.9" fill="#FFFFFF" />
        <line x1="0" y1="-16" x2="0" y2="-50" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="15.2" y1="-4.9" x2="47.5" y2="-15.5" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="9.4" y1="12.9" x2="29.5" y2="40.4" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="-9.4" y1="12.9" x2="-29.5" y2="40.4" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="-15.2" y1="-4.9" x2="-47.5" y2="-15.5" stroke="#FFFFFF" strokeWidth="2" />
      </g>
    </svg>
  );
}
