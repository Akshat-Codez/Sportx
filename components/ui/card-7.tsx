"use client"; // Required for state and event handlers

import * as React from "react";
import { cn } from "../../lib/utils"; // Adjusted path since this is in components/ui

interface InteractiveProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl: string;
  icon?: React.ReactNode;
  title: string;
  description: string;
  price: string;
}

export function InteractiveProductCard({
  className,
  imageUrl,
  icon,
  title,
  description,
  price,
  ...props
}: InteractiveProductCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  // --- MOUSE MOVE HANDLER ---
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    const rotateX = (y - height / 2) / (height / 2) * -8; // Max rotation 8deg
    const rotateY = (x - width / 2) / (width / 2) * 8;   // Max rotation 8deg

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`,
      transition: "transform 0.1s ease-out",
    });
  };

  // --- MOUSE LEAVE HANDLER ---
  const handleMouseLeave = () => {
    setStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 0.4s ease-in-out",
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: "preserve-3d", ...style }}
      className={cn(
        "group relative w-full max-w-[340px] aspect-[9/12] rounded-3xl bg-card shadow-lg",
        className
      )}
      {...props}
    >
      {/* Background Image - scales slightly to avoid showing edges on tilt */}
      <img
        src={imageUrl}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover rounded-3xl transition-transform duration-300 group-hover:scale-110"
        style={{ transform: "translateZ(-20px) scale(1.1)" }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent rounded-3xl" />

      {/* Main Content with 3D effect */}
      <div
        className="absolute inset-0 p-5 flex flex-col pointer-events-none"
        style={{ transform: "translateZ(40px)" }}
      >
        {/* Glassmorphism Header */}
        <div className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-xs text-white/70">{description}</p>
          </div>
          {icon && (
            <div className="text-white flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>

        {/* Price Tag - Absolute position for pixel perfection with 3D Z-axis pop on hover */}
        <div 
          className="absolute top-[108px] left-5 transition-transform duration-500 ease-out"
          style={{ transform: "translateZ(0px)" }}
        >
          <div className="rounded-full bg-black/60 shadow-lg px-4 py-1.5 text-sm font-bold text-white backdrop-blur-md border border-white/10 transition-all duration-300 group-hover:-translate-y-2 group-hover:scale-110" style={{ transform: "translateZ(40px)" }}>
            {price}
          </div>
        </div>

        {/* Pagination Dots - Pushed to the bottom */}
        <div className="mt-auto flex w-full justify-center gap-2 pb-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                index === 0 ? "bg-white" : "bg-white/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
