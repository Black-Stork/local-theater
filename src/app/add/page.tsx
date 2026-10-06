import { redirect } from "next/navigation";

export default function AddRedirectPage() {
  redirect("/queue?add=1");
}
