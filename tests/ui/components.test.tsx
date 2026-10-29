import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Cart, ProductCard as ProductCardData, Totals } from "@/lib/api/types";
import { setCsrfToken } from "@/lib/api/client";
import { ProductCard } from "@/components/product/ProductCard";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SafeImage } from "@/components/ui/SafeImage";
import { CartSummary } from "@/components/cart/CartSummary";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { pageWindow } from "@/components/ui/Pagination";
import { cursorTrailSupported } from "@/components/effects/CursorTrail";
import { AgeGate } from "@/components/compliance/AgeGate";
import { csrfRoute, json, mockFetch, renderWithProviders } from "./render";

const product = (over: Partial<ProductCardData> = {}): ProductCardData => ({
  id: "p1",
  slug: "vape-edge",
  name: "Vape Edge",
  shortDescription: "Compact pod device.",
  brand: { slug: "vopo", name: "Vopo" },
  category: { slug: "pod-systems", name: "Pod Systems" },
  image: { url: "/media/products/p-03.png", alt: "Vape Edge", width: 308, height: 332 },
  price: 12500,
  compareAtPrice: null,
  inStock: true,
  isNew: false,
  featured: false,
  defaultVariantId: "v1",
  variantCount: 1,
  ...over,
});

const totals: Totals = {
  itemCount: 2,
  subtotal: 18000,
  discount: 0,
  shipping: 1000,
  shippingRegion: "yerevan",
  shippingEstimated: true,
  freeShippingThreshold: 20000,
  amountToFreeShipping: 2000,
  vatRatePercent: 20,
  vatAmount: 3167,
  total: 19000,
};

const emptyCart: Cart = { id: "c1", items: [], totals: { ...totals, itemCount: 1 }, coupon: null, issues: [] };

describe("ProductCard", () => {
  it("shows AMD price without decimals and no fabricated star rating", () => {
    renderWithProviders(<ProductCard product={product()} />);
    expect(screen.getByRole("link", { name: "Vape Edge" })).toHaveAttribute("href", "/products/vape-edge");
    expect(screen.getByText("12 500 ֏")).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it("shows a sale badge and the struck regular price only for real sales", () => {
    renderWithProviders(<ProductCard product={product({ compareAtPrice: 15000 })} />);
    expect(screen.getByText("Sale")).toBeInTheDocument();
    expect(screen.getByText("15 000 ֏", { exact: false }).closest("del")).not.toBeNull();
  });

  it("disables the cart action for out-of-stock products", () => {
    renderWithProviders(<ProductCard product={product({ inStock: false })} />);
    expect(screen.getByRole("button", { name: /Out of stock: Vape Edge/ })).toBeDisabled();
  });

  it("links to the product to choose options when several variants exist", () => {
    renderWithProviders(<ProductCard product={product({ defaultVariantId: null, variantCount: 3 })} />);
    expect(screen.getByRole("link", { name: /Choose options: Vape Edge/ })).toHaveAttribute("href", "/products/vape-edge");
    expect(screen.getByText(/from 12 500 ֏/)).toBeInTheDocument();
  });

  it("adds to cart with loading → success, ignoring duplicate clicks", async () => {
    setCsrfToken(null);
    let release: () => void = () => undefined;
    const { calls } = mockFetch({
      ...csrfRoute,
      "POST /cart/items": () => new Promise<Response>((resolve) => (release = () => resolve(json({ data: emptyCart }, 201)))),
    });
    renderWithProviders(<ProductCard product={product()} />);
    const button = screen.getByRole("button", { name: /Add to cart: Vape Edge/ });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled());
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole("button", { name: "Added to cart" })).toBeInTheDocument());
    expect(calls.filter((c) => c.path === "/cart/items")).toHaveLength(1);
    expect(screen.getByText("Vape Edge was added to your cart.")).toBeInTheDocument();
  });

  it("reports server failures without claiming success", async () => {
    setCsrfToken("t.t");
    mockFetch({ "POST /cart/items": () => json({ error: { code: "INTERNAL", message: "boom" } }, 500) });
    renderWithProviders(<ProductCard product={product()} />);
    fireEvent.click(screen.getByRole("button", { name: /Add to cart: Vape Edge/ }));
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveAttribute("data-tone", "error");
    expect(within(toast).getByText(/Could not add to cart/)).toBeInTheDocument();
    expect(screen.queryByText("Vape Edge was added to your cart.")).not.toBeInTheDocument();
  });
});

describe("QuantityControl", () => {
  it("clamps to the available maximum and disables the increment there", async () => {
    const onChange = vi.fn();
    renderWithProviders(<QuantityControl value={3} max={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("normalizes typed values into range on blur", () => {
    const onChange = vi.fn();
    renderWithProviders(<QuantityControl value={1} max={5} onChange={onChange} />);
    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(5);
  });
});

describe("states", () => {
  it("ErrorState exposes an alert with a working retry", async () => {
    const retry = vi.fn();
    renderWithProviders(<ErrorState message="Could not load." onRetry={retry} />);
    const state = screen.getByTestId("error-state");
    expect(state).toHaveAttribute("role", "alert");
    expect(state).toHaveTextContent("Could not load.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("ErrorState disables retry while retrying", () => {
    renderWithProviders(<ErrorState message="x" onRetry={() => undefined} retrying />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
  });

  it("EmptyState renders a heading and action", () => {
    renderWithProviders(<EmptyState title="Nothing here" action={<button type="button">Go</button>} />);
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});

describe("SafeImage", () => {
  it("falls back to a designed placeholder when the image fails", () => {
    renderWithProviders(<SafeImage image={{ url: "/missing.png", alt: "Thing", width: 10, height: 10 }} width={10} height={10} />);
    fireEvent.error(screen.getByRole("img", { name: "Thing" }));
    expect(screen.getByTestId("image-fallback")).toHaveAccessibleName("No image available");
  });

  it("renders the placeholder when there is no image at all", () => {
    renderWithProviders(<SafeImage image={null} width={10} height={10} decorative />);
    expect(screen.getByTestId("image-fallback")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("CartSummary", () => {
  it("shows the VAT contained in the total and the free-shipping gap", () => {
    renderWithProviders(<CartSummary totals={totals} title="Cart Total" />);
    expect(screen.getByTestId("summary-total")).toHaveTextContent("19 000 ֏");
    expect(screen.getByTestId("summary-vat")).toHaveTextContent("3 167 ֏");
    expect(screen.getByText("incl. VAT 20%")).toBeInTheDocument();
    expect(screen.getByTestId("free-shipping-progress")).toHaveTextContent("Add 2 000 ֏ more for free delivery.");
    expect(screen.getByText("Delivery (Yerevan, estimate)")).toBeInTheDocument();
  });

  it("labels free delivery", () => {
    renderWithProviders(<CartSummary totals={{ ...totals, shipping: 0, amountToFreeShipping: 0, shippingEstimated: false }} title="T" />);
    expect(screen.getByTestId("summary-shipping")).toHaveTextContent("Free");
    expect(screen.getByText("You qualify for free delivery.")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("is an alertdialog that focuses Cancel and closes on Escape", async () => {
    const onCancel = vi.fn();
    renderWithProviders(<ConfirmDialog open title="Delete?" onConfirm={() => undefined} onCancel={onCancel} />);
    expect(screen.getByRole("alertdialog", { name: "Delete?" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("blocks duplicate confirmation while pending", () => {
    renderWithProviders(<ConfirmDialog open title="Delete?" pending onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByTestId("confirm-action")).toBeDisabled();
  });
});

describe("pagination window", () => {
  it("keeps first, last and neighbours with gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });
});

describe("cursor trail support", () => {
  const media = (map: Record<string, boolean>) => ({ matchMedia: (q: string) => ({ matches: map[q] ?? false }) as MediaQueryList });

  it("is enabled only for fine pointers without reduced motion", () => {
    expect(cursorTrailSupported(media({ "(hover: hover) and (pointer: fine)": true }))).toBe(true);
    expect(cursorTrailSupported(media({ "(hover: hover) and (pointer: fine)": false }))).toBe(false);
    expect(cursorTrailSupported(media({ "(hover: hover) and (pointer: fine)": true, "(prefers-reduced-motion: reduce)": true }))).toBe(false);
  });
});

describe("AgeGate", () => {
  it("records the confirmation on the server before closing", async () => {
    setCsrfToken("t.t");
    const { calls } = mockFetch({ "POST /compliance/age-confirmation": () => new Response(null, { status: 204 }) });
    renderWithProviders(<AgeGate initiallyConfirmed={false} />);
    expect(screen.getByRole("dialog", { name: "Are you 18 or older?" })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("age-confirm"));
    await waitFor(() => expect(screen.queryByTestId("age-gate")).not.toBeInTheDocument());
    expect(calls.some((c) => c.path === "/compliance/age-confirmation")).toBe(true);
    expect(document.cookie).toContain("vh_age=1");
  });

  it("keeps the gate open and shows an error when the server fails", async () => {
    setCsrfToken("t.t");
    mockFetch({ "POST /compliance/age-confirmation": () => json({ error: { code: "INTERNAL", message: "x" } }, 500) });
    renderWithProviders(<AgeGate initiallyConfirmed={false} />);
    await userEvent.click(screen.getByTestId("age-confirm"));
    const alert = await screen.findByTestId("form-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent("We could not record your confirmation");
    expect(screen.getByTestId("age-gate")).toBeInTheDocument();
  });

  it("shows the restricted message on exit and allows going back", async () => {
    renderWithProviders(<AgeGate initiallyConfirmed={false} />);
    await userEvent.click(screen.getByTestId("age-exit"));
    expect(screen.getByRole("heading", { name: "Access restricted" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I made a mistake, go back" }));
    expect(screen.getByTestId("age-confirm")).toBeInTheDocument();
  });

  it("does not render when already confirmed", () => {
    renderWithProviders(<AgeGate initiallyConfirmed />);
    expect(screen.queryByTestId("age-gate")).not.toBeInTheDocument();
  });
});
