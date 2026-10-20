"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="id">
      <body className="bg-white font-sans text-[#0F1B33]">
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <p className="text-sm font-semibold text-[#014FE7]">
              StudyDate ID
            </p>
            <h1 className="mt-4 text-3xl font-semibold">
              Halaman belum dapat ditampilkan
            </h1>
            <p className="mt-3 leading-7 text-[#526078]">
              Terjadi gangguan sementara. Data pribadimu tidak ditampilkan pada
              halaman ini.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 min-h-11 rounded-xl bg-[#014FE7] px-5 font-semibold text-white outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#014FE7]"
            >
              Coba lagi
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
