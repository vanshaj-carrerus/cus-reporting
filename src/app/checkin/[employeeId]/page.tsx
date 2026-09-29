import CheckInClient from "./CheckInClient";

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return <CheckInClient employeeId={employeeId} />;
}
