import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t bg-white px-6 py-6 text-sm text-gray-500 text-center">
      <Link href="/privacy" className="hover:text-blue-600 hover:underline">
        Политика конфиденциальности
      </Link>
    </footer>
  );
}
