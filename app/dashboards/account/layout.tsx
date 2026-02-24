import type { Metadata } from "next";
import React from "react";
import { Providers } from '../../providers';

export const metadata: Metadata = {
  title: "Accounts - Fine & Country Zimbabwe",
  description: "Accounts Dashboard for financial management, payments, and commission tracking",
};

export default function AccountLayout({
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
