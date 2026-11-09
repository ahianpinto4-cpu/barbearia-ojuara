"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { BookingModal } from "./BookingModal";

type BookingContextValue = {
  open: (serviceId?: string) => void;
  close: () => void;
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialService, setInitialService] = useState<string | undefined>();
  // A chave reinicia o formulário a cada nova abertura.
  const [session, setSession] = useState(0);

  const open = useCallback((serviceId?: string) => {
    setInitialService(serviceId);
    setSession((s) => s + 1);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <BookingContext.Provider value={{ open, close }}>
      {children}
      <BookingModal key={session} isOpen={isOpen} onClose={close} initialServiceId={initialService} />
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking deve ser usado dentro de <BookingProvider>");
  return ctx;
}
