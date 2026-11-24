"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { RESOURCES } from "@/lib/admin/resources";

export default function ResourceEditPage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = use(params);
  const def = RESOURCES[resource];
  if (!def || !/^[a-f\d]{24}$/i.test(id)) notFound();
  return <ResourceEditor key={id} def={def} id={id} />;
}
