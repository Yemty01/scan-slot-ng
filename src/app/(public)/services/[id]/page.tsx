export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Service detail</h1>
      <p className="text-muted-foreground">Service ID: {id}</p>
    </main>
  );
}
