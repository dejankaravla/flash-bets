import type { Metadata } from "next";
import { MyPredictionsContent } from "@/components/my-predictions/my-predictions-content";

export const metadata: Metadata = {
  title: "My Predictions · FlashBets",
  description: "Review active predictions, settled outcomes, FlashPoints, and receipts.",
};

export default function MyPredictionsPage() {
  return <MyPredictionsContent />;
}
