"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { BookingProvider } from "@/components/booking/BookingProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <BookingProvider>{children}</BookingProvider>
    </MotionConfig>
  );
}
