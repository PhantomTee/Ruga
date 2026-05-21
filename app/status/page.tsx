import { Metadata } from "next";
import { StatusClient } from "@/components/StatusClient";

export const metadata: Metadata = { title: "Agent Status" };

export default function StatusPage() {
  return <StatusClient />;
}
