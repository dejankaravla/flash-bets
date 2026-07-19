import { redirect } from "next/navigation";

export default function LegacyMyBetsPage() {
  redirect("/my-predictions");
}
