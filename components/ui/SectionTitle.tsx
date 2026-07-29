type SectionTitleProps = {
  children: React.ReactNode;
};

export default function SectionTitle({
  children,
}: SectionTitleProps) {
  return (
    <h2 className="text-3xl font-bold mb-6">
      {children}
    </h2>
  );
}