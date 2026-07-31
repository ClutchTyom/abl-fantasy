export default function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition">
      {children}
    </div>
  );
}