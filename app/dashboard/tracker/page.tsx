import { redirect } from "next/navigation";

export default function TrackerPageRedirect() {
  redirect("/dashboard/contacts");
}

