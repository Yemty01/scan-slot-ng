export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* Admin dashboard shell — nav/sidebar to be added */}
      {children}
    </div>
  );
}
