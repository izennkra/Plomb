import { redirect } from "next/navigation";

/** Plomb opens on the journal of the day. */
export default function Home() {
  redirect("/journal");
}
