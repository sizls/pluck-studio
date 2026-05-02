import { redirect } from "next/navigation";

export default function HomePage(): never {
  // Studio root redirects to bureau index – the bureau IS Studio's
  // primary surface. When other Studio sections land (devtools-cloud,
  // dashboards), this becomes a section picker.
  redirect("/bureau");
}
