/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      outletId: string;
      username: string;
      fullName: string;
      role: "owner" | "kasir";
      email?: string | null;
      pin?: string | null;
      isActive: boolean;
    } | null;
    outlet?: {
      id: string;
      name: string;
      address?: string | null;
      phone?: string | null;
      receiptFooter?: string | null;
      timezone: string;
    } | null;
    session?: {
      id: string;
      expiresAt: Date;
    } | null;
  }
}
