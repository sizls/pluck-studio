import { redirect } from "next/navigation";

export default function HomePage(): never {
  // Studio root redirects to /programs – Studio surfaces's
  // primary surface. When other Studio sections land (devtools-cloud,
  // dashboards), this becomes a section picker.
  redirect("/programs");
}
