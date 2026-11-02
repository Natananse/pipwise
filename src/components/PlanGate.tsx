import { useRouter } from "expo-router";
import React from "react";
import { Body, Button, Card } from "./ui";
import { Plan, planRank, useSession } from "../lib/session";

/** Shows children if the user's plan is high enough; otherwise a lock card (or `locked`). */
export function PlanGate({
  required,
  children,
  locked,
}: {
  required: Plan;
  children: React.ReactNode;
  locked?: React.ReactNode;
}) {
  const { plan } = useSession();
  const router = useRouter();
  if (planRank[plan] >= planRank[required]) return <>{children}</>;
  return (
    <>
      {locked ?? (
        <Card>
          <Body>This is a {required} feature. Upgrade to unlock it.</Body>
          <Button label="See plans" onPress={() => router.push("/paywall")} />
        </Card>
      )}
    </>
  );
}
