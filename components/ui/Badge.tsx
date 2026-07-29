type BadgeProps = {
  text: string;
};

export default function Badge({
  text,
}: BadgeProps) {
  return (
    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
      {text}
    </span>
  );
}