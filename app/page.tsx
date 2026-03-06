import Navbar from "@/components/Navbar"
import Link from "next/link"

export default function Home() {

  return (
    <main className="bg-white dark:bg-black text-gray-900 dark:text-white">

      <Navbar />

      {/* Hero */}

      <section className="text-center py-28 px-6">

        <h1 className="text-6xl font-bold leading-tight">
          Print Anything On Campus <br />
          <span className="text-primary">
            Fast. Simple. Reliable.
          </span>
        </h1>

        <p className="mt-6 text-gray-700 dark:text-gray-400 max-w-xl mx-auto">
          Upload your document and nearby approved student suppliers print it for you.
          Real-time updates. Transparent pricing.
        </p>

        <div className="mt-10 flex justify-center gap-6">

          <Link
            href="/create-order"
            className="px-6 py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90"
          >
            Order Now
          </Link>

          <Link
            href="/supplier"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary"
          >
            Supplier Portal 
          </Link>

        </div>

      </section>


      {/* Features */}

      <section className="py-20 bg-gray-100 dark:bg-card">

        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 px-8">

          {[
            {
              title: "Instant Matching",
              desc: "Your order instantly reaches active campus suppliers."
            },
            {
              title: "Live Updates",
              desc: "Track order status in real-time."
            },
            {
              title: "Affordable Rates",
              desc: "Transparent pricing with no hidden costs."
            }
          ].map((item, i) => (

            <div
              key={i}
              className="bg-white dark:bg-dark p-8 rounded-2xl shadow-sm dark:shadow-none"
            >

              <h3 className="text-xl font-semibold text-primary mb-3">
                {item.title}
              </h3>

              <p className="text-gray-700 dark:text-gray-400">
                {item.desc}
              </p>

            </div>

          ))}

        </div>

      </section>


      {/* Pricing */}

      <section className="py-20 text-center">

        <h2 className="text-3xl font-bold mb-12">
          Pricing
        </h2>

        <div className="flex justify-center gap-8 flex-wrap">

          {[
            { type: "Black & White", price: "₹2 / page" },
            { type: "Color", price: "₹5 / page" },
            { type: "Glossy", price: "₹15 / page" }
          ].map((item, i) => (

            <div
              key={i}
              className="bg-gray-100 dark:bg-card p-8 rounded-2xl w-64"
            >

              <h4 className="text-xl font-semibold mb-4">
                {item.type}
              </h4>

              <p className="text-3xl font-bold text-primary">
                {item.price}
              </p>

            </div>

          ))}

        </div>

      </section>


      {/* Footer */}

      <footer className="border-t border-gray-200 dark:border-gray-800 py-10 text-center text-gray-500">

        © {new Date().getFullYear()} PrintMyPage. Built for Campus.

      </footer>

    </main>
  )
}