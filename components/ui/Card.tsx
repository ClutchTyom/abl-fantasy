type CardProps = {
  children: React.ReactNode;
};

export default function Card({
  children,
}: CardProps) {
  return (
    <div className="border rounded-xl p-5 shadow-md bg-white">
      {children}
    </div>
  );
}