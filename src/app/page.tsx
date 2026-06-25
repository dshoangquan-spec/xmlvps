import InvoiceProcessor from "@/components/invoice-processor";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-background p-4 pt-12 sm:p-8 md:pt-24">
      <div className="w-full max-w-7xl">
        <InvoiceProcessor />
      </div>
    </main>
  );
}
