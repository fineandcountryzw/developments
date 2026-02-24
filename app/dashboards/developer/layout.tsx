import type { Metadata } from "next";
import React from "react";
import { Providers } from '../../providers';

export const metadata: Metadata = {
  title: "Developer Portal - Fine & Country Zimbabwe",
  description: "Developer Dashboard for property development management, stand sales, and payment tracking",
};

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {children}
    </Providers>
  );
}
