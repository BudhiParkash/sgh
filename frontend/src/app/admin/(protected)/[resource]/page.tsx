"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { ResourceList } from "@/components/admin/resource-list";
import { RESOURCES } from "@/lib/admin/resources";

export default function ResourceListPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = use(params);
  const def = RESOURCES[resource];
  if (!def) notFound();
  return <ResourceList def={def} />;
}
