export default async function PatientBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Booking detail</h1>
      <p className="text-muted-foreground">Booking ID: {id}</p>
    </main>
  );
}
