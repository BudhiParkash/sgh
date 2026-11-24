"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { RESOURCES } from "@/lib/admin/resources";

export default function ResourceNewPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = use(params);
  const def = RESOURCES[resource];
  if (!def) notFound();
  return <ResourceEditor def={def} />;
}
