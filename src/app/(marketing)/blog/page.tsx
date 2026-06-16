const POSTS = [
  {
    title: "How 22K gold rates are calculated",
    date: "12 Jun 2026",
    excerpt:
      "We use international spot gold prices converted to INR, adjusted for 22K purity — so you always know the benchmark behind your loan.",
  },
  {
    title: "What happens to your gold after you pledge",
    date: "5 Jun 2026",
    excerpt:
      "From weighing to sealing in a tamper-proof packet — a step-by-step look at how we keep your ornaments safe.",
  },
  {
    title: "Part payment vs part release: what's the difference?",
    date: "28 May 2026",
    excerpt:
      "Pay down your loan in chunks, or take back some ornaments while keeping the rest pledged. Here's how each option works.",
  },
];

export default function BlogPage() {
  return (
    <div className="ym-page">
      <div className="ym-container">
        <h1 className="ym-page-title">Blog</h1>
        <p className="ym-section-subtitle">
          Guides and updates on gold loans, rates, and managing your pledge.
        </p>

        <div className="ym-prose" style={{ marginTop: "2rem", maxWidth: "42rem" }}>
          {POSTS.map((post) => (
            <article key={post.title} className="ym-blog-card">
              <p className="ym-blog-date">{post.date}</p>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
