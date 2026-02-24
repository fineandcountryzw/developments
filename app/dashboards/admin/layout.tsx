import type { Metadata } from "next";
import React from "react";
import { Providers } from '../../providers';

export const metadata: Metadata = {
  title: "Admin - Fine & Country Zimbabwe",
  description: "Admin Dashboard with full access to Development Wizard and all modules",
};

export default function AdminLayout({
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
