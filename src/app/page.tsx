import InvoiceProcessor from "@/components/invoice-processor";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      <InvoiceProcessor />
    </main>
  );
}
