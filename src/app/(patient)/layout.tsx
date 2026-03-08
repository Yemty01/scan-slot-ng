export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* Patient dashboard shell — nav/sidebar to be added */}
      {children}
    </div>
  );
}
