/** Route-level skeleton shown while a server page is rendering (navigation feedback). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" data-testid="route-loading">
      <div className="page-header">
        <div className="page-header__content">
          <div className="skeleton h-10 w-[min(340px,70vw)]" />
          <div className="skeleton h-4 w-40" />
        </div>
      </div>
      <section className="py-80">
        <div className="container-vh">
          <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="product-card p-4">
                <div className="skeleton mb-4 aspect-[308/332] w-full" />
                <div className="skeleton mb-2 h-5 w-2/3" />
                <div className="skeleton h-4 w-1/3" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
